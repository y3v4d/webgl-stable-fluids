function hsvToRgb(h: number, s: number, v: number) {
    let r = 0, g = 0, b = 0;
    let i = Math.floor(h * 6);  // Determine the segment of the hue
    let f = h * 6 - i;          // Fractional part of the hue
    let p = v * (1 - s);        // Calculate intermediate values
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    // Determine the final RGB values based on the hue segment
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)]; // Convert to 0-255 range
}

export function densityFieldToColor(field: Float32Array, dest: ImageData) {
    const buffer = dest.data;

    for(let i = 0; i < field.length / 2; i++) {
        const x = field[i * 2];
        const y = field[i * 2 + 1];

        const length = Math.sqrt(x * x + y * y);

        buffer[i * 4 + 0] = length * 255;
        buffer[i * 4 + 1] = length * 255;
        buffer[i * 4 + 2] = length * 255;
    }
}

export function velocityFieldToColor(field: Float32Array, dest: ImageData) {
    const buffer = dest.data;

    for(let i = 0; i < field.length / 2; i++) {
        const x = field[i * 2 + 0];
        const y = field[i * 2 + 1];

        const angle = Math.atan2(y, x);
        const length = Math.sqrt(x * x + y * y);

        const [r, g, b] = hsvToRgb((angle + Math.PI) / (2 * Math.PI), 1, length);

        const index = i * 4;
        buffer[index + 0] = r;
        buffer[index + 1] = g;
        buffer[index + 2] = b;
    }
}

export function bilinearInterpolation(src: Float32Array, width: number, height: number, x: number, y: number) {
    const x0 = Math.max(0, Math.min(Math.floor(x), width - 1));
    const x1 = Math.min(x0 + 1, width - 1);
    const y0 = Math.max(0, Math.min(Math.floor(y), height - 1));
    const y1 = Math.min(y0 + 1, height - 1);

    const dx = x - x0;
    const dy = y - y0;

    function getSrcValues(x: number, y: number) {
        const index = (x + y * width) * 2;
        return [src[index], src[index + 1]];
    }

    const [q00x, q00y] = getSrcValues(x0, y0);
    const [q01x, q01y] = getSrcValues(x0, y1);
    const [q10x, q10y] = getSrcValues(x1, y0);
    const [q11x, q11y] = getSrcValues(x1, y1);

    const r0x = q00x * (1 - dx) + q10x * dx;
    const r1x = q01x * (1 - dx) + q11x * dx;
    const r0y = q00y * (1 - dx) + q01y * dx;
    const r1y = q10y * (1 - dx) + q11y * dx;

    return [r0x * (1 - dy) + r1x * dy, r0y * (1 - dy) + r1y * dy];
}

export function jacobi(dest: Float32Array, src: Float32Array, width: number, height: number, alpha: number, beta: number, iterations: number) {
    beta = 1 / beta;

    const v_next = new Float32Array(dest.length);
    dest.set(src);

    for(let i = 0; i < iterations; ++i) {
        for(let y = 1; y < height - 1; ++y) {
            for(let x = 1; x < width - 1; ++x) {
                const index = (x + y * width) * 2;

                const left = index - 2;
                const right = index + 2;
                const up = index - width * 2;
                const down = index + width * 2;

                v_next[index + 0] = (src[index + 0] + alpha * (dest[left] + dest[right] + dest[up] + dest[down])) * beta;
                v_next[index + 1] = (src[index + 1] + alpha * (dest[left + 1] + dest[right + 1] + dest[up + 1] + dest[down + 1])) * beta;
            }
        }

        dest.set(v_next);

        setBoundries(dest, width, height);
    }
}

export function diffuse(dest: Float32Array, src: Float32Array, width: number, height: number, viscosity: number, dt: number) {
    const alpha = dt * viscosity;
    const beta = 1 + 4 * alpha;

    jacobi(dest, src, width, height, alpha, beta, 40);
    //setBoundries(dest, width, height);
}

export function advection(dest: Float32Array, src: Float32Array, u: Float32Array, width: number, height: number, dt: number) {
    for(let y = 0; y < height; ++y) {
        for(let x = 0; x < width; ++x) {
            const index = (x + y * width) * 2;

            // use BFECC method
            /*const x_depart = x - dt * u[index + 0];
            const y_depart = y - dt * u[index + 1];

            const [vx_depart, vy_depart] = bilinearInterpolation(u, width, height, x_depart, y_depart);

            const x_new1 = x_depart + dt * vx_depart;
            const y_new1 = y_depart + dt * vy_depart;

            const error_x = x_new1 - x;
            const error_y = y_new1 - y;

            const x_new2 = x - error_x / 2;
            const y_new2 = y - error_y / 2;

            const [vx_2, vy_2] = bilinearInterpolation(u, width, height, x_new2, y_new2);

            const x_new3 = x_new2 - vx_2 * dt;
            const y_new3 = y_new2 - vy_2 * dt;

            const [x_interpolated, y_interpolated] = bilinearInterpolation(src, width, height, x_new3, y_new3);

            dest[index + 0] = x_interpolated;
            dest[index + 1] = y_interpolated;*/


            // semi langarian method
            const x_depart = x - dt * u[index + 0];
            const y_depart = y - dt * u[index + 1];

            const [x_interpolated, y_interpolated] = bilinearInterpolation(src, width, height, x_depart, y_depart);

            dest[index + 0] = x_interpolated;
            dest[index + 1] = y_interpolated;
        }
    }

    
}



export function project(dest: Float32Array, src: Float32Array, width: number, height: number, dt: number) {
    const div = new Float32Array(width * height * 2);
    const p = new Float32Array(width * height * 2).fill(0);

    for(let y = 1; y < height - 1; ++y) {
        for(let x = 1; x < width - 1; ++x) {
            const index = (x + y * width) * 2;

            const dv_dx = src[index + 2] - src[index - 2];
            const dv_dy = src[index + width * 2 + 1] - src[index - width * 2 + 1];

            div[index + 0] = -0.5 * (dv_dx + dv_dy);
            div[index + 1] = 0;
        }
    }

    setBoundries(div, width, height);

    jacobi(p, div, width, height, 1, 4, 40);

    for(let y = 1; y < height - 1; ++y) {
        for(let x = 1; x < width - 1; ++x) {
            const index = (x + y * width) * 2;

            dest[index + 0] = src[index + 0] - 0.5 * (p[index + 2] - p[index - 2]);
            dest[index + 1] = src[index + 1] - 0.5 * (p[index + width * 2] - p[index - width * 2]);
        }
    }

    setBoundries(dest, width, height);
}

export function setBoundries(v: Float32Array, width: number, height: number) {
    // set 0 velocity on the vertcial and horziontal edges and corners
    for(let x = 0; x < width; ++x) {
        const topIndex = x * 2;
        const bottomIndex = ((height - 1) * width + x) * 2;

        v[topIndex + 1] = v[bottomIndex + 1] = 0;
    }

    for(let y = 1; y < height - 1; ++y) {
        const leftIndex = y * width * 2;
        const rightIndex = (y * width + width - 1) * 2;

        v[leftIndex + 0] = v[rightIndex + 0] = 0;
    }
}