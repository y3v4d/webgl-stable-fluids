export class Color {
    r: number = 0;
    g: number = 0;
    b: number = 0;

    constructor(r: number, g: number, b: number) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
}

export function clear(dest: ImageData, color: Color) {
    const buffer = dest.data;

    for(let i = 0; i < buffer.length; i += 4) {
        buffer[i + 0] = color.r;
        buffer[i + 1] = color.g;
        buffer[i + 2] = color.b;
        buffer[i + 3] = 255;
    }
}

export function drawCircle(dest: ImageData, cx: number, cy: number, radius: number, color: Color, feather_edges: number = 2) {
    const buffer = dest.data;

    for(let y = 0; y < radius * 2; ++y) {
        for(let x = 0; x < radius * 2; ++x) {
            const dx = x - radius;
            const dy = y - radius;

            if(cx + dx < 0 || cx + dx >= dest.width || cy + dy < 0 || cy + dy >= dest.height) {
                continue;
            }

            const distance = Math.sqrt(dx * dx + dy * dy);
            if(distance > radius) {
                continue;
            }

            let alpha = 1;
            if(distance > radius - feather_edges) {
                alpha = 1 - (distance - (radius - feather_edges)) / feather_edges;
            }

            const index = (dx + cx + (dy + cy) * dest.width) * 4;
            
            const r = buffer[index + 0] * (1 - alpha) + color.r * alpha;
            const g = buffer[index + 1] * (1 - alpha) + color.g * alpha;
            const b = buffer[index + 2] * (1 - alpha) + color.b * alpha;

            buffer[index + 0] = r;
            buffer[index + 1] = g;
            buffer[index + 2] = b;
        }
    }
}