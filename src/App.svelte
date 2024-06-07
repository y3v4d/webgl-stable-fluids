<script lang="ts">
    import { onDestroy, onMount } from "svelte";

    import { Color, clear } from "./drawer";
    import { advection, densityFieldToColor, diffuse, project, velocityFieldToColor } from "./fluid";

    let canvas: HTMLCanvasElement;
    const DISPLAY_CANVAS_WIDTH: number = 256;
    const DISPLAY_CANVAS_HEIGHT: number = 256;
    const CANVAS_WIDTH: number = 256;
    const CANVAS_HEIGHT: number = 256;

    let totalDensity = 0;
    let mode: "velocity" | "density" = "density";

    const pixels: ImageData = new ImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    let velocity_field = new Float32Array(CANVAS_WIDTH * CANVAS_HEIGHT * 2).fill(0);
    let velocity_field2 = new Float32Array(CANVAS_WIDTH * CANVAS_HEIGHT * 2).fill(0);
    let forces = new Float32Array(CANVAS_WIDTH * CANVAS_HEIGHT * 2).fill(0);

    for(let y = 0; y < CANVAS_HEIGHT; ++y) {
        for(let x = 0; x < CANVAS_WIDTH; ++x) {
            const i = (y * CANVAS_WIDTH + x) * 2;
            //velocity_field2[i] = 1;
            velocity_field2[i + 1] = 0;
        }
    }

    let scalar_field = new Float32Array(CANVAS_WIDTH * CANVAS_HEIGHT * 2).fill(0);
    let scalar_field2 = new Float32Array(CANVAS_WIDTH * CANVAS_HEIGHT * 2).fill(0);

    for(let y = CANVAS_HEIGHT / 2 - 32; y < CANVAS_HEIGHT / 2 + 32; ++y) {
        for(let x = CANVAS_WIDTH / 2 - 32; x < CANVAS_WIDTH / 2 + 32; ++x) {
            const i = (y * CANVAS_WIDTH + x) * 2;
            scalar_field[i] = 1;
            scalar_field[i + 1] = 0;
        }
    }

    let lastMouse: [number, number] = [0, 0];
    let recordedLastMouse = false;
    let done = false;
    let sum = 0;

    function onKeyDown(event: KeyboardEvent) {
        if(event.key === "v") {
            mode = "velocity";
        } else if(event.key === "d") {
            mode = "density";
        }

        console.log(mode);
    }

    function onMouseMove(event: MouseEvent) {
        const currentMouse = getMousePosition(event);
        if(currentMouse[0] < 0 || currentMouse[0] >= CANVAS_WIDTH || currentMouse[1] < 0 || currentMouse[1] >= CANVAS_HEIGHT) return;

        console.log(event.which);

        if(!recordedLastMouse) {
            lastMouse[0] = currentMouse[0];
            lastMouse[1] = currentMouse[1];

            recordedLastMouse = true;
        }

        const delta = [currentMouse[0] - lastMouse[0], currentMouse[1] - lastMouse[1]];
        const length = Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1]);
        if(length === 0) return;

        const power = 1;
        const radius = 16;

        for(let y = 0; y < radius; y++) {
            for(let x = 0; x < radius; x++) {
                const x_centered = x - radius / 2;
                const y_centered = y - radius / 2;

                if(Math.sqrt(x_centered * x_centered + y_centered * y_centered) > radius / 2) continue;

                const i = ((currentMouse[1] + y - radius / 2) * CANVAS_WIDTH + currentMouse[0] + x - radius / 2) * 2;
                if(i >= forces.length - 1 || i < 0) continue;

                forces[i] += delta[0] / length * power;
                forces[i + 1] += delta[1] / length * power;
            }
        }

        lastMouse[0] = currentMouse[0];
        lastMouse[1] = currentMouse[1];
    }

    function getMousePosition(event: MouseEvent): [number, number] {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        return [x, y];
    }

    onMount(() => {
        const ctx = canvas.getContext("2d");
        if(!ctx) return;

        ctx.scale(5, 5);

        clear(pixels, new Color(196, 164, 132));

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("keydown", onKeyDown);

        let startTime: number = -1;

        const loop = (timestamp: number) => {
            if(startTime === -1) {
                startTime = timestamp;
            }

            const dt = 1;//(timestamp - startTime) / 1000 * 100;
            startTime = timestamp;

            clear(pixels, new Color(196, 164, 132));

            velocity_field.set(velocity_field2);

            for(let i = 0; i < forces.length; i++) {
                velocity_field[i] += forces[i];
            }
            

            //advection(velocity_field2, velocity_field, velocity_field, CANVAS_WIDTH, CANVAS_HEIGHT, dt);
            //velocity_field2.set(velocity_field);

            diffuse(velocity_field2, velocity_field, CANVAS_WIDTH, CANVAS_HEIGHT, 100, dt);
            //project(velocity_field, velocity_field2, CANVAS_WIDTH, CANVAS_HEIGHT, dt);
            velocity_field.set(velocity_field2);
            advection(velocity_field2, velocity_field, velocity_field, CANVAS_WIDTH, CANVAS_HEIGHT, dt);
            project(velocity_field, velocity_field2, CANVAS_WIDTH, CANVAS_HEIGHT, dt);
            velocity_field2.set(velocity_field);
            //velocityFieldToColor(velocity_field2, pixels);

            diffuse(scalar_field2, scalar_field, CANVAS_WIDTH, CANVAS_HEIGHT, 0, dt);
            advection(scalar_field, scalar_field2, velocity_field2, CANVAS_WIDTH, CANVAS_HEIGHT, dt);
            //scalar_field2.set(scalar_field);
            
            //scalar_field.set(scalar_field2);

            //advection()

            if(mode === "velocity") {
                velocityFieldToColor(velocity_field2, pixels);
            } else {
                densityFieldToColor(scalar_field, pixels);
            }

            ctx.putImageData(pixels, 0, 0);

            forces.fill(0);
            sum = velocity_field2.reduce((acc, val) => acc + Math.abs(val), 0);
            totalDensity = scalar_field.reduce((acc, val) => acc + val, 0);

            !done && requestAnimationFrame(loop);
        }

        loop(0);
    });

    onDestroy(() => {
        done = true;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("keydown", onKeyDown);
    });
</script>

<main class="bg-yellow-400">
    <h1 class="text-3xl font-bold">Stable Fluids</h1>
    <canvas bind:this={canvas} on:contextmenu={(e) => e.preventDefault()} class="rounded-lg border-black border-2" width={DISPLAY_CANVAS_WIDTH} height={DISPLAY_CANVAS_HEIGHT}></canvas>
    <p>Sum: {sum}</p>
    <p>Total density: {totalDensity}</p>

    <footer>
        <p class="text-sm text-gray-500">Made with ❤️ by y3v4d. Based on paper by Jos Stam.</p>
    </footer>
</main>

<style>
</style>
