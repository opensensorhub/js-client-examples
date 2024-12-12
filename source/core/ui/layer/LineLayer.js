/***************************** BEGIN LICENSE BLOCK ***************************

 The contents of this file are subject to the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed with this file, You can obtain one
 at http://mozilla.org/MPL/2.0/.

 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the License.

 Copyright (C) 2015-2020 Mathieu Dhainaut. All Rights Reserved.

 Author: Mathieu Dhainaut <mathieu.dhainaut@gmail.com>

 ******************************* END LICENSE BLOCK ***************************/

import Layer from "./Layer.js";
import { isDefined } from "../../utils/Utils.js";

/**
 * @extends Layer
 * @example
 *
 * import LineLayer from 'core/ui/layer/LineLayer.js';
 *
 * let lineLayer = new LineLayer({
         getStartLocationAndBearing: (rec: any) => {
             return {
                 startLocation: {
                     x: rec.location.lon,
                     y: rec.location.lat,
                     z: rec.location.alt,
                },
                bearing: rec['raw-lob'] * Math.PI / 180
             }
         },
         color : 'rgba(0,0,255,0.5)',
         weight : 10,
         opacity : .5,
    });
 */
class LineLayer extends Layer {
    /**
     * Creates the LineLayer
     * @param {Object} properties
     * // TODO
     * @param {Object[]} [properties.locations] - defines the start and end location of the line [lat, lon]
     * @param {Number} [properties.weight=1] - defines the weight of the polyline
     * @param {String} [properties.color='red'] - defines the color of the polyline
     * @param {Number} [properties.opacity=1] - defines the opacity of the polyline
     * @param {Number} [properties.maxPoints=2] - defines a number max of points. should only ever be 2
     * @param {Boolean} [properties.clampToGround=true] - defines if the line has to be clamped to ground
     * @param {Number} [properties.distanceKm] - defines the distance of the line
     * @param {Function} [properties.getStartLocationAndBearing] - defines a function to return the start location and bearing
     * @param {Function} [properties.getColor] - defines a function to return the color
     * @param {Function} [properties.getWeight] - defines a function to return the weight
     * @param {Function} [properties.getOpacity] - defines a function to return the opacity
     */
    constructor(properties) {
        super(properties);
        this.type = 'polyline';
    }

    // called by super class
    init(properties=this.properties) {
        super.init(properties);
        const props = {
            type: 'polyline',
            locations: [],
            distanceKm: 200,
            color: 'red',
            weight: 1,
            opacity: 1,
            polylineId: 'bearingLine',
            clampToGround: true,
            maxPoints: 2,
            properties: properties,
        };

        if (isDefined(properties.locations)){
            props.locations = properties.locations;
        }

        if (isDefined(properties.color)){
            props.color = properties.color;
        }

        if (isDefined(properties.weight)){
            props.weight = properties.weight;
        }

        if (isDefined(properties.opacity)){
            props.opacity = properties.opacity;
        }

        if (isDefined(properties.distanceKm)){
            props.distanceKm = properties.distanceKm;
        }

        if (isDefined(properties.clampToGround)){
            props.clampToGround = properties.clampToGround;
        }

        this.definedId('polylineId', props);

        if (isDefined(properties.getStartLocationAndBearing)) {
            const fn = async (rec, timestamp, options) => {
                const {startLocation: startLoc, bearing} = await this.getFunc('getStartLocationAndBearing')(rec, timestamp, options);
                const endLoc = this.getEndLoc(startLoc, bearing, props.distanceKm);
                this.updateProperty('locations', [startLoc, endLoc]);
            };
            this.addFn(this.getDataSourcesIdsByProperty('getStartLocationAndBearing'),fn);
        }
    }

    clear() {
        const currentProps = this.getCurrentProps();
        currentProps.locations = [];
    }

    // Given coordinates, will calculate new coordinates distanceKm away in a given direction (bearing)
    getEndLoc(startLocation, bearing, distanceKm) {
        const earthRadius = 6371;

        // FOR CESIUM MAPS
        let computedDistance = (distanceKm / earthRadius);

        // Convert to radians
        const startPosRadians = {
            lat: (startLocation.y * Math.PI) / 180,
            lon:
                startLocation.x < 0
                    ? ((360 + startLocation.x) * Math.PI) / 180
                    : (startLocation.x * Math.PI) / 180,
            alt: startLocation.z,
        };

        const endLatRadians = Math.asin(
            Math.sin(startPosRadians.lat) * Math.cos(computedDistance) +
            Math.cos(startPosRadians.lat) *
            Math.sin(computedDistance) *
            Math.cos(bearing)
        );

        const endLonRadians =
            startPosRadians.lon +
            Math.atan2(
                Math.sin(bearing) *
                Math.sin(computedDistance) *
                Math.cos(startPosRadians.lat),
                Math.cos(computedDistance) -
                Math.sin(startPosRadians.lat) * Math.sin(endLatRadians)
            );

        // FOR CESIUM MAPS
        let endPosLon = (endLonRadians * 180) / Math.PI;

        if (endPosLon > 180) {
            endPosLon -= 360;
        }

        if (endPosLon < -180) {
            endPosLon += 360;
        }

        return {
            x: endPosLon,
            y: (endLatRadians * 180) / Math.PI,
            z: startLocation.z,
        };
    }
}

export default LineLayer;
