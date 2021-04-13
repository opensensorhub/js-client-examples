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
import WebCodecApi from "./WebCodecApi";
import WebAudioApi from "./WebAudioApi";
import {isDefined} from "../../../utils/Utils";
import AudioTimeDomainCanvas from "./canvas/AudioTimeDomainCanvas";
import AudioFrequencyDomainCanvas from "./canvas/AudioFrequencyDomainCanvas";
import AudioTimeDomainChartJs from "./chart/AudioTimeDomainChartJs";

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
     * @param {string} properties.flush - Number of elements to concatenate before flushing (for WebAudioApi only)
     * @param {string} properties.css - The css classes to set, can be multiple if separate by spaces
     * @param {boolean} properties.visible - set the default behavior of the visibility of the view
     * @param {number} properties.gain - set the gain to be applied to the input  before its propagation to the output
     * @param {Object[]}  [properties.layers=[]] - The initial layers to add
     */
    constructor(properties) {
        super({
            flush: 2,
            supportedLayers: ['data'],
            gain: 1.0,
            ...properties,
            visible: true
        });
        this.initViews();
        this.initDecoder();
    }

   initViews() {
       this.views = {};

       if(isDefined(this.properties.timeDomainVisualization)) {
           this.views.timeDomainVisualization = this.properties.timeDomainVisualization;
       }

       if(isDefined(this.properties.frequencyDomainVisualization)) {
           this.views.frequencyDomainVisualization = this.properties.frequencyDomainVisualization;
       }

       if(isDefined(this.views.timeDomainVisualization)) {
           if(this.views.timeDomainVisualization.type === 'canvas') {
               this.views.timeDomainVisualization.view = new AudioTimeDomainCanvas({
                   nodeElement: this.elementDiv,
                   ...this.views.timeDomainVisualization
               });
           } else if(this.views.timeDomainVisualization.type === 'chart') {
               this.views.timeDomainVisualization.view = new AudioTimeDomainChartJs({
                   nodeElement: this.elementDiv,
                   ...this.views.timeDomainVisualization
               });
           }
       }

       if(isDefined(this.views.frequencyDomainVisualization)) {
           if(this.views.frequencyDomainVisualization.type === 'canvas') {
               this.views.frequencyDomainVisualization.view = new AudioFrequencyDomainCanvas({
                   nodeElement: this.elementDiv,
                   ...this.views.frequencyDomainVisualization
               });
           }
       }
    }

   initDecoder() {
       try {
           this.decoder = new WebCodecApi(this.properties);
           console.warn('using WebCodec for audio decoding');
       }catch (error) {
           this.decoder = new WebAudioApi(this.properties);
           console.warn('using WebAudioApi for audio decoding');
       }
       this.decoder.onDecodedBuffer = (decodedSample) => {
           if(isDefined(this.views.frequencyDomainVisualization)) {
               this.views.frequencyDomainVisualization.view.draw(decodedSample);
           }
           if(isDefined(this.views.timeDomainVisualization)) {
               this.views.timeDomainVisualization.view.draw(decodedSample);
           }
           this.onDecodedBuffer(decodedSample);
       }
       this.decoder.onEnded = (decodedSample) => {
           if(isDefined(this.views.frequencyDomainVisualization)) {
               this.views.frequencyDomainVisualization.view.onended(decodedSample);
           }
           if(isDefined(this.views.timeDomainVisualization)) {
               this.views.timeDomainVisualization.view.onended(decodedSample);
           }
           this.onEnded(decodedSample);
       }
    }

    draw(decodedSample) {

    }

    async setData(dataSourceId, data) {
        for (let value of data.values) {
            await this.decoder.decode(value.data,value.timeStamp);
        }
    }

    reset() {
        this.decoder.reset();
    }

    onDecodedBuffer(decodedBuffer){
    }

    onEnded(decodedBuffer){
    }
    getCurrentTime() {
        return this.decoder.getCurrentTime();
    }
}
export default AudioView;



