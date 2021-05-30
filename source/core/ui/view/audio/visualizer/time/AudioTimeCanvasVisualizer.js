import AudioCanvasVisualizer from "../AudioCanvasVisualizer";

/**
 * Class to visualize audio time domain using Native canvas drawing
 * @param {Object} [properties={}] - the properties of the view
 * @param {number} properties.fftSize - The fftSize property of the AnalyserNode interface is an unsigned long value and represents the window size in samples that is used when performing a Fast Fourier Transform (FFT) to get time domain data.
 * @param {string} properties.container - The div element to attach to
 * @param {string} properties.css - The css classes to set, can be multiple if separate by spaces
 */
class AudioTimeCanvasVisualizer extends AudioCanvasVisualizer {
    constructor(properties) {
        super({
            fftSize: 1024,
            ...properties,
            type: 'time',
            format: 'float'
        });
    }

    draw(decodedSample) {
        const dataArray = decodedSample[this.properties.type][this.properties.format];

        try {

            const WIDTH = this.canvas.width;
            const HEIGHT = this.canvas.height + (25*100/this.canvas.height);

            this.canvasCtx.fillStyle = 'rgb(255, 255, 255)';
            this.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

            this.canvasCtx.lineWidth = 2;
            this.canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

            this.canvasCtx.beginPath();

            let sliceWidth = WIDTH / dataArray.length;
            let x = 0;

            for (let i = 0; i < dataArray.length; i++) {

                let v = dataArray[i];
                let y = v * HEIGHT + HEIGHT/2;
                if (i === 0) {
                    this.canvasCtx.moveTo(x, y);
                } else {
                    this.canvasCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }
            this.canvasCtx.strokeStyle = 'rgb(0,139,141)';
            this.canvasCtx.lineTo(WIDTH, HEIGHT / 2);
            this.canvasCtx.stroke();

            this.canvasCtx.fillStyle = 'rgba(198,198,198,0.8)';
            this.canvasCtx.fillRect(0, 0, 1, HEIGHT);
            this.canvasCtx.fillRect(0, HEIGHT-10, WIDTH, 2);
        }catch (error) {
            console.error(error);
        }
    }
}

export default AudioTimeCanvasVisualizer;
