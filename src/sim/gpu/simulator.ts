import type { Settings } from "@/settings";

import { domainWidthFor } from "../domain";
import type { Vec2 } from "../motion";
import { GRID_ROWS, MAX_GRID_COLUMNS, PARTICLE_STRIDE } from "../params";
import { countParticles, createParticles } from "../scenes";
import { type Stats, summarize } from "../stats";
import { substepsFor } from "../timestep";
import { packUniforms, type Pointer, UNIFORM_BYTES } from "../uniforms";
import { COMPUTE_SHADER, RENDER_SHADER } from "./shaders";

const WORKGROUP_SIZE = 64;
const FLOAT_BYTES = 4;
const CELL_VALUES = 3;
const BACKGROUND = { r: 0.04, g: 0.06, b: 0.1, a: 1 };

const workgroups = (items: number): number => Math.ceil(items / WORKGROUP_SIZE);

interface Scenario {
  count: number;
  /** Columns the particles were last stepped under, the width they are known to fit. */
  columns: number;
  particles: GPUBuffer;
  staging: GPUBuffer;
  computeGroup: GPUBindGroup;
  renderGroup: GPUBindGroup;
}

type Pipelines = Record<
  "clearGrid" | "particleToGrid" | "updateGrid" | "gridToParticle",
  GPUComputePipeline
>;

interface Resources {
  device: GPUDevice;
  context: GPUCanvasContext;
  uniforms: GPUBuffer;
  grid: GPUBuffer;
  gridVelocity: GPUBuffer;
  computeLayout: GPUBindGroupLayout;
  pipelines: Pipelines;
  renderPipeline: GPURenderPipeline;
}

/** Owns the WebGPU device and runs the MLS-MPM solver and its renderer on it. */
export class Simulator {
  private scenario: Scenario | undefined;
  private reading = false;
  private gridColumns: number;
  /** Set by any domain resize, cleared by `load`, even when the width returns to what it was. */
  private resizedSinceLoad = false;

  private readonly device: GPUDevice;
  private readonly context: GPUCanvasContext;
  private readonly uniforms: GPUBuffer;
  private readonly grid: GPUBuffer;
  private readonly gridVelocity: GPUBuffer;
  private readonly computeLayout: GPUBindGroupLayout;
  private readonly pipelines: Pipelines;
  private readonly renderPipeline: GPURenderPipeline;

  private constructor(resources: Resources, gridColumns: number) {
    this.gridColumns = gridColumns;
    this.device = resources.device;
    this.context = resources.context;
    this.uniforms = resources.uniforms;
    this.grid = resources.grid;
    this.gridVelocity = resources.gridVelocity;
    this.computeLayout = resources.computeLayout;
    this.pipelines = resources.pipelines;
    this.renderPipeline = resources.renderPipeline;
  }

  /**
   * Resolves to undefined when the browser has no usable WebGPU adapter, or when
   * `signal` aborts first. The canvas has one context for every device, and the
   * last `configure` wins, so an aborted create must not reach it.
   */
  static async create(
    canvas: HTMLCanvasElement,
    signal: AbortSignal,
    gridColumns: number,
  ): Promise<Simulator | undefined> {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter === null) return undefined;
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (context === null || signal.aborted) {
      device.destroy();
      return undefined;
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });

    const storage = (size: number): GPUBuffer =>
      device.createBuffer({
        size,
        usage: GPUBufferUsage.STORAGE,
      });
    const uniforms = device.createBuffer({
      size: UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const cells = MAX_GRID_COLUMNS * GRID_ROWS;
    const grid = storage(cells * CELL_VALUES * FLOAT_BYTES);
    const gridVelocity = storage(cells * 2 * FLOAT_BYTES);

    const entry = (
      binding: number,
      type: GPUBufferBindingType,
    ): GPUBindGroupLayoutEntry => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type },
    });
    const computeLayout = device.createBindGroupLayout({
      entries: [
        entry(0, "uniform"),
        entry(1, "storage"),
        entry(2, "storage"),
        entry(3, "storage"),
      ],
    });
    const computeModule = device.createShaderModule({ code: COMPUTE_SHADER });
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [computeLayout],
    });
    const pipeline = (entryPoint: string): GPUComputePipeline =>
      device.createComputePipeline({
        layout,
        compute: { module: computeModule, entryPoint },
      });

    const renderModule = device.createShaderModule({ code: RENDER_SHADER });
    const renderPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vertexMain" },
      fragment: {
        module: renderModule,
        entryPoint: "fragmentMain",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });

    return new Simulator(
      {
        device,
        context,
        uniforms,
        grid,
        gridVelocity,
        computeLayout,
        pipelines: {
          clearGrid: pipeline("clearGrid"),
          particleToGrid: pipeline("particleToGrid"),
          updateGrid: pipeline("updateGrid"),
          gridToParticle: pipeline("gridToParticle"),
        },
        renderPipeline,
      },
      gridColumns,
    );
  }

  /** Resize the domain to `gridColumns` cells wide; the loaded scene keeps its layout until `load`. */
  setGridColumns(gridColumns: number): void {
    if (gridColumns !== this.gridColumns) this.resizedSinceLoad = true;
    this.gridColumns = gridColumns;
  }

  get sceneIsStale(): boolean {
    return this.resizedSinceLoad;
  }

  /** Replace the particles with a fresh copy of the scene. */
  load(scene: Settings["scene"]): void {
    this.scenario?.particles.destroy();
    this.scenario?.staging.destroy();

    this.resizedSinceLoad = false;
    const data = createParticles(scene, domainWidthFor(this.gridColumns));
    const count = countParticles(data);
    const particles = this.device.createBuffer({
      size: data.byteLength,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(particles, 0, data);
    const staging = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const computeGroup = this.device.createBindGroup({
      layout: this.computeLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniforms } },
        { binding: 1, resource: { buffer: particles } },
        { binding: 2, resource: { buffer: this.grid } },
        { binding: 3, resource: { buffer: this.gridVelocity } },
      ],
    });
    const renderGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particles } },
        { binding: 1, resource: { buffer: this.uniforms } },
      ],
    });
    this.scenario = {
      count,
      columns: this.gridColumns,
      particles,
      staging,
      computeGroup,
      renderGroup,
    };
  }

  /**
   * Advance one rendered frame under gravity `pull` (units of 1 g) and draw it.
   * With `readStats`, the particle buffer is copied back and summarised; resolves undefined when a previous
   * read is still pending or nothing was requested.
   */
  async frame(
    settings: Settings,
    pointer: Pointer,
    pull: Vec2,
    options: { step: boolean; readStats: boolean },
  ): Promise<Stats | undefined> {
    const { scenario } = this;
    if (scenario === undefined) return undefined;

    this.device.queue.writeBuffer(
      this.uniforms,
      0,
      packUniforms(settings, scenario.count, pointer, pull, this.gridColumns),
    );
    const encoder = this.device.createCommandEncoder();

    if (options.step) {
      scenario.columns = this.gridColumns;
      const cells = this.gridColumns * GRID_ROWS;
      const pass = encoder.beginComputePass();
      pass.setBindGroup(0, scenario.computeGroup);
      for (let step = 0; step < substepsFor(settings.stiffness); step++) {
        pass.setPipeline(this.pipelines.clearGrid);
        pass.dispatchWorkgroups(workgroups(cells));
        pass.setPipeline(this.pipelines.particleToGrid);
        pass.dispatchWorkgroups(workgroups(scenario.count));
        pass.setPipeline(this.pipelines.updateGrid);
        pass.dispatchWorkgroups(workgroups(cells));
        pass.setPipeline(this.pipelines.gridToParticle);
        pass.dispatchWorkgroups(workgroups(scenario.count));
      }
      pass.end();
    }

    const render = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: BACKGROUND,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    render.setPipeline(this.renderPipeline);
    render.setBindGroup(0, scenario.renderGroup);
    render.draw(6, scenario.count);
    render.end();

    const read = options.readStats && !this.reading;
    if (read) {
      encoder.copyBufferToBuffer(
        scenario.particles,
        0,
        scenario.staging,
        0,
        scenario.count * PARTICLE_STRIDE * FLOAT_BYTES,
      );
    }
    this.device.queue.submit([encoder.finish()]);
    if (!read) {
      // Callers wait on this, so a slow GPU never gets more frames queued than it can run.
      await this.device.queue.onSubmittedWorkDone();
      return undefined;
    }

    this.reading = true;
    const { columns } = scenario;
    try {
      await scenario.staging.mapAsync(GPUMapMode.READ);
      const stats = summarize(
        new Float32Array(scenario.staging.getMappedRange()).slice(),
        domainWidthFor(columns),
      );
      scenario.staging.unmap();
      return stats;
    } catch {
      // The scene was replaced while the read was pending; its staging buffer is gone.
      return undefined;
    } finally {
      this.reading = false;
    }
  }

  destroy(): void {
    this.scenario?.particles.destroy();
    this.scenario?.staging.destroy();
    this.uniforms.destroy();
    this.grid.destroy();
    this.gridVelocity.destroy();
    this.device.destroy();
  }
}
