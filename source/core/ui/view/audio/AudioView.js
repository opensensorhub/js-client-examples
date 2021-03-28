/***************************** BEGIN LICENSE BLOCK ***************************
 The contents of this file are subject to the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed with this file, You can obtain one
 at http://mozilla.org/MPL/2.0/.
 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the License.
 Copyright (C) 2015-2021 Mathieu Dhainaut. All Rights Reserved.
 Author: Mathieu Dhainaut <mathieu.dhainaut@gmail.com>
 ******************************* END LICENSE BLOCK ***************************/

import View from "../View.js";
import AudioPlayerWorklet from './worklets/audio.worklet.js'
import AudioPlayer from "../../../../../issues/354/hello-audio-worklet/processor.worklet";

/**
 * This class is in charge of listening Audio using either default native WebAPI or compatible WebCodec(if supported)
 * @extends View
 * @example
 *
 import AudioView from 'core/ui/view/audio/AudioView.js';

 let audioView = new AudioView({
  container: 'audio-container',
  name: 'Audio',
  dataSourceId: audioDatasource.id
});
 */

class AudioView extends View {

    /**
     * Create a View.
     * @param {Object} [properties={}] - the properties of the view
     * @param {string} properties.container - The div element to attach to
     * @param {string} properties.flush - Number of elements to concatenate before flushing
     * @param {string} properties.css - The css classes to set, can be multiple if separate by spaces
     * @param {boolean} properties.visible - set the default behavior of the visibility of the view
     * @param {Object[]}  [properties.layers=[]] - The initial layers to add
     */
    constructor(properties) {
        super({
            flush: 2,
            supportedLayers: ['data'],
            ...properties
        });

        this.initDecoder();
    }

   initDecoder() {
       try {
           this.decoder = new WebCodec(this.properties);
           console.warn('using WebCodec for audio decoding');
       }catch (error) {
           this.decoder = new WebAudioApi(this.properties);
           console.warn('using WebAudioApi for audio decoding');
       }
       this.decoder.onDecodedBuffer = (decodedBuffer) => {
           this.onDecodedBuffer(decodedBuffer);
       }
    }

    async setData(dataSourceId, data) {
        for (let value of data.values) {
            await this.decoder.decode(value.data);
        }
    }

    reset() {
        this.decoder.reset();
    }

    onDecodedBuffer(decodedBuffer){
    }

    getCurrentTime() {
        return this.decoder.getCurrentTime();
    }
}
export default AudioView;

// fallback version
class WebAudioApi {
    constructor(properties) {
        let AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        // time audio position
        this.deltaInc = 0;

        // the current audio buffer to read, can be a concatenation of multiple decoded audio buffers
        this.audioBuffer = null;
        // define the size of the audiobuffer to concatenate
        this.flushLimit = properties.flush;
        // current count used for flushing
        this.count = 0;
        this.init = false;
    }

    concat(buffer1, buffer2){
        const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);

        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);

        return tmp.buffer;
    }

    async decode(data) {
        if (!this.init) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'playback',
                sampleRate: data.sampleRate,
            });
            this.audioCtx.resume();
            await this.audioCtx.audioWorklet.addModule(AudioPlayer);

            this.workletNode = new AudioWorkletNode(this.audioCtx, 'audio-player', {
                outputChannelCount: [1]  // mono
            })
            this.workletNode.connect(this.audioCtx.destination);
            this.init = true;
        }

        if(this.count === 0) {
            this.audioBuffer = data.frameData.buffer;
        } else {
            this.audioBuffer = this.concat(this.audioBuffer, data.frameData.buffer);
        }

        if(this.count >= this.flushLimit) {
            await this.flush();
            this.count = 0;
        } else {
            this.count++;
        }
    }

    async flush() {
        try {
            let audioBufferChunk = await this.audioCtx.decodeAudioData(this.audioBuffer);
            let buf = audioBufferChunk.getChannelData(0).buffer;
            this.workletNode.port.postMessage({data: buf}, [buf]);
        }catch (e){
            console.error(e);
        }
    }

    reset() {

    }

    onDecodedBuffer(decodedBuffer){}

    getCurrentTime() {
        if(this.audioCtx === null){
            return 0;
        }
        return this.audioCtx.currentTime;
    }

}

class WebCodec {
    constructor(properties) {
        // time audio position
        this.deltaInc = 0;
        this.init = false;
        this.key = true;
        this.audioCtx = null;

        try {
            // check for supported webcodec
            this.audioDecoder = new AudioDecoder({
                output: (decodedSample) => {
                    const buffer = decodedSample.buffer;
                    let source = this.audioCtx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(this.audioCtx.destination);
                    source.start(this.deltaInc);
                    this.deltaInc += buffer.duration;

                    this.onDecodedBuffer(decodedSample.buffer);
                },
                error: (error) => {
                    console.error(error);
                }
            });


        } catch (e) {
            // WebCodec is not supported
            throw new Error('WebCodec is not supported');
        }
    }

    async decode(data) {
        if (!this.init) {
            let AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext({
                sampleRate: data.sampleRate,
                latencyHint: 'interactive'
            });

            await this.audioDecoder.configure({
                codec: 'mp4a.40.2',
                numberOfChannels: 1,
                sampleRate: data.sampleRate
            });
            this.init = true;
        }

        const chunk = new EncodedAudioChunk({
            type:  this.key? "key" : "delta",
            data: data.frameData.buffer,
            timestamp: 0
        });

        try {
            this.audioDecoder.decode(chunk);
        } catch (error) {
            console.error(error);
        }
    }

    reset() {
        if(this.init) {
            this.init = false;
        }
    }

    onDecodedBuffer(decodedBuffer){
        console.log('decoded')
    }

    getCurrentTime() {
        if(this.audioCtx === null){
            return 0;
        }
        return this.audioCtx.currentTime;
    }

}
