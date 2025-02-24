import SosGetResultAudio from "osh-js/core/datasource/SosGetResultAudio";
import AudioView from "osh-js/core/ui/view/audio/AudioView";
import AudioFrequencyCanvasVisualizer
    from "osh-js/core/ui/view/audio/visualizer/frequency/AudioFrequencyCanvasVisualizer";
import AudioTimeCanvasVisualizer from "osh-js/core/ui/view/audio/visualizer/time/AudioTimeCanvasVisualizer";
import AudioFrequencyChartJsVisualizer
    from "osh-js/core/ui/view/audio/visualizer/frequency/AudioFrequencyChartJsVisualizer";
import AudioTimeChartJsVisualizer from "osh-js/core/ui/view/audio/visualizer/time/AudioTimeChartJsVisualizer";
import AudioSpectrogramVisualizer from "osh-js/core/ui/view/audio/visualizer/spectrogram/AudioSpectrogramVisualizer";

let audioDataSource = new SosGetResultAudio("alex-audio", {
  protocol: "ws",
  service: "SOS",
  endpointUrl: "sensiasoft.net:8181/sensorhub/sos",
  offeringID: "urn:android:device:dd90fceba7fd5b47-sos",
  observedProperty: "http://sensorml.com/ont/swe/property/AudioFrame",
  startTime: "2021-04-12T10:48:45Z",
  endTime: "2021-04-12T10:49:45Z",
  replaySpeed: 1.0,
  bufferingTime: 1000
});

let audioView = new AudioView({
 name: "Audio",
 css: 'audio-css',
 container: 'audio-chart-container',
 dataSource: audioDataSource,
 gain: 5,
 playSound: true
});

const audioCanvasFrequencyVisualizer = new AudioFrequencyCanvasVisualizer({
    fftSize: 32,
    barWidth:20,
    css: 'audio-canvas',
    container: 'canvas-frequency'
});
const audioCanvasTimeVisualizer = new AudioTimeCanvasVisualizer({
    fftSize: 1024,
    css: 'audio-canvas',
    container: 'canvas-time'
});

const audioChartFrequencyVisualizer = new AudioFrequencyChartJsVisualizer({
    css: 'audio-canvas',
    fftSize: 32,
    container: 'chart-frequency',
    chartjsProps: {
        datasetsProps: {
            borderColor: 'rgba(0,0,0,0.5)',
            backgroundColor: 'rgba(210,210,210,0.8)',
            barThickness: 20,
            borderWidth: 1
        },
    }
});

const audioChartTimeVisualizer = new AudioTimeChartJsVisualizer({
    css: 'audio-canvas',
    fftSize: 1024,
    container: 'chart-time',
    chartjsProps: {
        chartProps: {
            scales: {
                yAxes: [{
                    scaleLabel: {
                        labelString: "Amplitude"
                    },
                    ticks: {
                        maxTicksLimit: 5
                    }
                }],
                xAxes: [{
                    scaleLabel: {
                        labelString: "Time"
                    },
                    ticks: {
                        maxTicksLimit: 130,
                        beginAtZero: true
                    }
                }],
            },
            maintainAspectRatio: false
        },
        datasetsProps: {
            pointRadius: 0.1,
            borderColor: 'rgba(0,0,0,0.5)',
            backgroundColor: 'rgba(255,195,100,0.2)',
            barThickness: 2,
            borderWidth: 1
        },
        datasetsMinMaxProps: {
            pointRadius: 0.0,
            backgroundColor: 'rgba(0,139,141,1.0)',
            barThickness: 2,
            borderWidth: 1
        }
    }
});

const audioSpectrogramVisualizer = new AudioSpectrogramVisualizer({
    fftSize: 2048,
    container: 'spectrogram'
});

audioView.addVisualizer(audioCanvasFrequencyVisualizer);
audioView.addVisualizer(audioCanvasTimeVisualizer);
audioView.addVisualizer(audioChartFrequencyVisualizer);
audioView.addVisualizer(audioChartTimeVisualizer);
audioView.addVisualizer(audioSpectrogramVisualizer);

document.getElementById("listen").onclick = () => {
  audioDataSource.connect();
}

const inputChartElt = document.getElementById("input-range-chart");
inputChartElt.onchange = (event) => {
  document.getElementById("range-value-chart").innerText = inputChartElt.value;
  audioView.setGain(parseInt(inputChartElt.value));
}
