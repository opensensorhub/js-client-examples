/***************************** BEGIN LICENSE BLOCK ***************************

 The contents of this file are subject to the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed with this file, You can obtain one
 at http://mozilla.org/MPL/2.0/.

 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the License.

 Copyright (C) 2015-2021 Georobotix Inc. All Rights Reserved.

 Author: Mathieu Dhainaut <mathieu.dhainaut@gmail.com>

 ******************************* END LICENSE BLOCK ***************************/
import {isDefined} from "../utils/Utils";

class ObservationFilter {
    /**
     *
     * @param {Object} properties - object properties
     * @param {string[]} [properties.datastreamIds=[]] - list of datastream ids
     * @param {any} [properties.phenomenonTime='now'] - time range <00:00:00T00:00:00Z/00:00:00T00:00:00Z> | 'now' | 'latest'
     * @param {any} [properties.resultTime='now'] - time range <00:00:00T00:00:00Z/00:00:00T00:00:00Z> | 'latest'
     * @param {Number[]} properties.bbox
     * @param {Number[]} properties.roi
     * @param {string[]} properties.propNames
     * @param {string[]} properties.propUris
     */
    constructor(properties) {
        this.datastreamIds = [];
        // time range | latest
        this.phenomenonTime = 'now';
        this.resultTime  = 'latest';
        this.bbox = null;
        this.roi = null;
        this.propNames = [];
        this.propUris = [];

        if(isDefined(properties.datastreamIds)){
            this.datastreamIds = properties.datastreamIds;
        }
        if(isDefined(properties.phenomenonTime)){
            this.phenomenonTime = properties.phenomenonTime;
        }
        if(isDefined(properties.resultTime)){
            this.resultTime = properties.resultTime;
        }
        if(isDefined(properties.bbox)){
            this.bbox = properties.bbox;
        }
        if(isDefined(properties.roi)){
            this.roi = properties.roi;
        }
        if(isDefined(properties.propNames)){
            this.propNames = properties.propNames;
        }
        if(isDefined(properties.propUris)){
            this.propUris = properties.propUris;
        }
    }
}
export default ObservationFilter;
