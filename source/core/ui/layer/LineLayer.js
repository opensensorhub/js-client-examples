/***************************** BEGIN LICENSE BLOCK ***************************

 TODO

 ******************************* END LICENSE BLOCK ***************************/

import Layer from "./Layer.js";
import { isDefined } from "../../utils/Utils.js";

/**
 * @extends Layer
 * @example
 *
 * xxx
 */
class LineLayer extends Layer {
    /**
     * Creates the LineLayer
     * @param {Object} properties
     * xxx
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
            color: 'red',
            weight: 1,
            opacity: 1,
            polylineId: 'bearingLine',
            clampToGround: false,
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

        if (isDefined(properties.clampToGround)){
            props.clampToGround = properties.clampToGround;
        }

        // I think this should be polylineId but I don't know why yet
        this.definedId('polylineId', props);

        // TODO bearing = heading * Math.PI / 180
        if (isDefined(properties.getBearing)) {
            const fn = async (rec, timestamp, options) => {
                this.updateProperty('bearing', await this.getFunc('getBearing')(rec, timestamp, options));
            };
            this.addFn(this.getDataSourcesIdsByProperty('getBearing'), fn);
        }

        if (isDefined(properties.getLocation)) {
            const fn = async (rec, timestamp, options) => {
                const startLoc = await this.getFunc('getLocation')(rec, timestamp, options);
                const endLoc = this.getEndLoc(startLoc, this.props.bearing, this.props.distanceKm);
                this.updateProperty('locations', [startLoc, endLoc]);
            };
            this.addFn(this.getDataSourcesIdsByProperty('getLocation'),fn);
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
            lat: (endLatRadians * 180) / Math.PI,
            lon: endPosLon,
            alt: startLocation.z,
        };
    }
}

export default LineLayer;
