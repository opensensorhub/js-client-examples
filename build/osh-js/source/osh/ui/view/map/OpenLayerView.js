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

import {isDefined, randomUUID} from "../../../utils/Utils.js";
import 'ol/css.js';
import 'ol/ol.css';
import {Map, View as OlView} from 'ol';
import TileLayer from 'ol/layer/Tile.js';
import {Group} from "ol/layer.js";
import {transform} from "ol/proj.js";
import {defaults as defaultInteractions, DragRotateAndZoom} from 'ol/interaction.js';
import {defaults as defaultControls, FullScreen} from 'ol/control.js';
import {ZoomSlider} from 'ol/control.js';
import VectorSource from "ol/source/Vector.js";
import VectorLayer from "ol/layer/Vector.js";
import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js';
import {Icon, Style} from 'ol/style.js';
import Select from "ol/interaction/Select";
import OSM from "ol/source/OSM";
import MouseWheelZoom from "ol/interaction/MouseWheelZoom";
import LayerSwitcher from 'ol-layerswitcher';
import 'ol-layerswitcher/dist/ol-layerswitcher.css';
import MapView from "./MapView";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import LineString from "ol/geom/LineString";
import {click, pointerMove} from "ol/events/condition";


/**
 * This class is in charge of displaying GPS/orientation data by adding a marker to the OpenLayer Map object.
 * @extends MapView
 */
class OpenLayerView extends MapView {
    /**
     * Create a View.
     * @param {Object} [properties={}] - the properties of the view
     * @param {String} properties.container - The div element to attach to
     * @param {Object[]}  [properties.layers=[]] - The initial layers to add
     * @param {Boolean} [properties.autoZoomOnFirstMarker=false] - auto zoom on the first added marker
     * @param {Object} [properties.map] - the [Map]{@link https://openlayers.org/en/latest/apidoc/module-ol_Map-Map.html} object to use
     * @param {Number} [properties.maxZoom=19] - the max zoom value
     * @param {Boolean} [properties.autoZoomOnFirstMarker=false] - auto zoom on the first added marker
     * @param {Object} [properties.initialView] - The initial View can be passed to override the default [View]{@link https://openlayers.org/en/latest/apidoc/module-ol_View-View.html}
     * @param {Object} properties.initialView.lon - the corresponding longitude in EPSG:4326
     * @param {Object} properties.initialView.lat - the corresponding latitude in EPSG:4326
     * @param {Object} properties.initialView.zoom - the default level zoom
     * @param {Object[]} [properties.overlayLayers] - OpenLayers objects to use as overlay layer
     * @param {Object[]} [properties.baseLayers] - OpenLayers objects to use as base layer
     *
     */
    constructor(properties) {
        super({
            supportedLayers: ['marker', 'polyline'],
            ...properties
        });
    }

    beforeAddingItems(options) {
        // inits the map
        this.initMap(options);
    }


    /**
     * Updates the marker associated to the layer.
     * @param {PointMarkerLayer.props} props - The layer properties allowing the update of the marker
     */
    updateMarker(props) {
        let marker = this.getMarker(props);
        if (!isDefined(marker)) {
            // adds a new marker to the leaflet renderer
            const markerObj = this.addMarker({
                lat: props.location.y,
                lon: props.location.x,
                orientation: props.orientation.heading,
                color: props.color,
                icon: props.icon,
                anchor: props.iconAnchor,
                name: props.name,
                id: props.id+"$"+props.markerId
            });

            this.addMarkerToLayer(props, markerObj);
        }

        let markerFeature = this.getMarker(props);
        // updates position
        let lon = props.location.x;
        let lat = props.location.y;

        if (!isNaN(lon) && !isNaN(lat)) {
            let coordinates = transform([lon, lat], 'EPSG:4326', 'EPSG:900913');
            markerFeature.getGeometry().setCoordinates(coordinates);
        }

        // updates orientation
        if (props.icon !== null) {
            // updates icon
            let iconStyle = new Style({
                image: new Icon({
                    opacity: 0.75,
                    anchor: props.iconAnchor,
                    anchorYUnits: 'pixels',
                    anchorXUnits: 'pixels',
                    src: props.icon,
                    rotation: props.orientation.heading * Math.PI / 180
                })
            });
            markerFeature.setStyle(iconStyle);
        }
    }

    /**
     * Updates the polyline associated to the layer.
     * @param {Polyline.props} props - The layer allowing the update of the polyline
     */
    updatePolyline(props) {
        let polyline = this.getPolyline(props);
        if (isDefined(polyline)) {
            // removes the layer
            this.removePolylineFromLayer(polyline);
        }

        const polylineObj = this.addPolyline(props.locations[props.polylineId], {
            color: props.color,
            weight: props.weight,
            locations: props.locations,
            maxPoints: props.maxPoints,
            opacity: props.opacity,
            smoothFactor: props.smoothFactor,
            name: props.name
        });

        this.addPolylineToLayer(props, polylineObj);

        //TODO: handle opacity, smoothFactor, color and weight
        // if (polylineId in this.polylines) {
        //     let geometry = this.polylines[polylineId];
        //
        //     let polylinePoints = [];
        //     for (let i = 0; i < layer.locations.length; i++) {
        //         polylinePoints.push(transform([layer.locations[i].x, layer.locations[i].y], 'EPSG:4326', 'EPSG:900913'))
        //     }
        //
        //     geometry.setCoordinates(polylinePoints);
        // }
    }

    //---------- MAP SETUP --------------//
    /**
     * @private
     */
    initMap(options) {

        this.map = null;
        let initialView = null;
        this.first = true;
        let overlays = [];

        let baseLayers = this.getDefaultLayers();
        let maxZoom = 19;

        if (isDefined(options)) {

            //if the user passed in a map then use that one, don't make a new one
            if (options.map) {
                this.map = options.map;
                return;
            }

            if (options.maxZoom) {
                maxZoom = options.maxZoom;
            }
            if (options.initialView) {
                initialView = new OlView({
                    center: transform([options.initialView.lon, options.initialView.lat], 'EPSG:4326', 'EPSG:900913'),
                    zoom: options.initialView.zoom,
                    maxZoom: maxZoom
                });
            }
            // checks autoZoom
            if (!options.autoZoomOnFirstMarker) {
                this.first = false;
            }

            // checks overlayers
            if (options.overlayLayers) {
                overlays = options.overlayLayers;
            }

            // checks baseLayer
            if (options.baseLayers) {
                baseLayers = options.baseLayers;
            }
        }
        // #region snippet_openlayerview_initial_view
        if (initialView === null) {
            // loads the default one
            initialView = new OlView({
                center: transform([0, 0], 'EPSG:4326', 'EPSG:900913'),
                zoom: 5,
                maxZoom: maxZoom
            });
        }
        // #endregion snippet_openlayerview_initial_view

        // sets layers to map
        //create map
        this.map = new Map({
            target: this.divId,
            controls: defaultControls().extend([
                new FullScreen()
            ]),
            interactions: defaultInteractions({mouseWheelZoom: false}).extend([
                new DragRotateAndZoom(),
                new MouseWheelZoom({
                    constrainResolution: true, // force zooming to a integer zoom,
                    duration: 200
                })
            ]),
            layers: [
                new Group({
                    'title': 'Base maps',
                    layers: baseLayers
                }),
                new Group({
                    title: 'Overlays',
                    layers: overlays
                })
            ],
            view: initialView,

        });

        const layerSwitcher = new LayerSwitcher({
            tipLabel: 'Legend', // Optional label for button
            groupSelectStyle: 'children' // Can be 'children' [default], 'group' or 'none'
        });
        this.map.addControl(layerSwitcher);
        this.map.addControl(new ZoomSlider());

        // inits onLeftClick events
        // select interaction working on "click"
        const selectClick = new Select({
            condition: click,
            style: null
        });

        const selectRightClick = new Select({
            condition: function(e) {
                return (e.type === 'contextmenu');
            },
            style: null
        });

        // select interaction working on "pointermove"
        const selectPointerMove = new Select({
            condition: pointerMove,
            style: null
        });

        this.map.addInteraction(selectClick);
        this.map.addInteraction(selectRightClick);
        this.map.addInteraction(selectPointerMove);
        const that = this;

        selectRightClick.on('select', function (e) {
            if(e.selected.length > 0 ) {
                let feature = e.selected[0]; //the feature selected
                const mId = that.getMarkerId(feature.getId());
                if (!isDefined(mId)) {
                    return;
                }
                const sId = that.getLayerId(feature.getId());
                if (!isDefined(sId)) {
                    return;
                }
                const layer = that.getLayer(sId);
                if (!isDefined(layer)) {
                    return;
                }
                that.onMarkerRightClick(mId, feature, layer.props, e);
            }
        });
        selectClick.on('select', function (e) {
            if(e.selected.length > 0 ) {
                let feature = e.selected[0]; //the feature selected
                const mId = that.getMarkerId(feature.getId());
                if (!isDefined(mId)) {
                    return;
                }
                const sId = that.getLayerId(feature.getId());
                if (!isDefined(sId)) {
                    return;
                }
                const layer = that.getLayer(sId);
                if (!isDefined(layer)) {
                    return;
                }
                that.onMarkerLeftClick(mId, feature, layer.props, e);
            }
        });

        selectPointerMove.on('select', function (e) {
            if(e.selected.length > 0 ) {
                let feature = e.selected[0]; //the feature selected
                const mId = that.getMarkerId(feature.getId());
                if (!isDefined(mId)) {
                    return;
                }
                const sId = that.getLayerId(feature.getId());
                if (!isDefined(sId)) {
                    return;
                }
                const layer = that.getLayer(sId);
                if (!isDefined(layer)) {
                    return;
                }
                that.onMarkerHover(mId, feature, layer.props, e);
            }
        });

        this.vectorSource = new VectorSource({
            wrapX: false,
            features: []
        });

        let vectorMarkerLayer = new VectorLayer({
            source: this.vectorSource,
        });

        this.map.addLayer(vectorMarkerLayer);
        this.map.updateSize();
    }

    /**
     * Gets the list of default layers.
     * @return {Array}
     */
    getDefaultLayers() {
        let osm = new TileLayer({
            source: new OSM()
        });
        return [osm];
    }

    /**
     * Add a marker to the map.
     * @param {Object} properties
     * @param {Number} properties.lon
     * @param {Number} properties.lat
     * @param {String} properties.icon - path of the icon
     * @param {Number} properties.orientation - orientation in degree
     * @param {String} properties.id - the id of the new created marker: layer.id$layer.markerId
     * @return {Object} the new marker object
     */
    addMarker(properties) {
        //create marker
        if(isDefined(this.map) &&  this.map !== null) {
            let marker = new Point(transform([properties.lon, properties.lat], 'EPSG:4326', 'EPSG:900913'));
            let markerFeature = new Feature({
                geometry: marker,
                name: 'Marker' //TODO
            });

            let style = {
                symbol: {
                    symbolType: 'image',
                    size: [16, 16],
                    color: 'lightyellow',
                    rotateWithView: false,
                    offset: [0, 9]
                }
            };

            if (isDefined(properties.icon) && properties.icon !== null) {
                let iconStyle = new Style({
                    image: new Icon({
                        opacity: 0.75,
                        src: properties.icon,
                        rotation: properties.orientation * Math.PI / 180
                    }),
                });
                markerFeature.setStyle(iconStyle);
            }

            markerFeature.setId(properties.id);
            this.vectorSource.addFeature(markerFeature);

            if (this.first) {
                this.first = false;
                this.map.getView().setCenter(transform([properties.lon, properties.lat], 'EPSG:4326', 'EPSG:900913'));
                this.map.getView().setZoom(12);
            }

            return markerFeature;
        }
        this.onResize();
        //TODO: exception
        return null;
    }

    /**
     * Abstract method to remove a marker from its corresponding layer.
     * This is library dependent.
     * @param {Object} marker - The Map marker object
     */
    removeMarkerFromLayer(marker) {
        this.vectorSource.removeFeature(marker);
    }

    /**
     * Abstract method to remove a polyline from its corresponding layer.
     * This is library dependant.
     * @param {Object} polyline - The Map polyline object
     */
    removePolylineFromLayer(polyline) {
        this.map.removeLayer(polyline);
    }

    /**
     *
     * @private
     * @param layer
     * @return {string} the id of the newly created marker, or the id of the marker if it already exists from the current layer
     */
    createMarkerFromLayer(layer) {
        //This method is intended to create a marker object only for the OpenLayerView. It does not actually add it
        //to the view or map to give the user more control
        let marker = this.getMarker(layer);
        if (!isDefined(marker)) {
            let properties = {
                lat: layer.location.y,
                lon: layer.location.x,
                orientation: layer.orientation.heading,
                color: layer.color,
                icon: layer.icon,
                name: this.names[layer.markerId]
            }

            //create marker
            let markerPoint = new Point(transform([properties.lon, properties.lat], 'EPSG:4326', 'EPSG:900913'));
            marker = new Feature({
                geometry: markerPoint,
                name: 'Marker' //TODO
            });

            if (properties.icon !== null) {
                let iconStyle = new Style({
                    image: new Icon({
                        opacity: 0.75,
                        src: properties.icon,
                        rotation: properties.orientation * Math.PI / 180
                    })
                });
                marker.setStyle(iconStyle);
            }
            let id = "view-marker-" + randomUUID();
            marker.setId(id);
        }
        return this.getMarker(layer);
    }


    /**
     * Add a polyline to the map.
     * @param {locations} locations - the coordinates [{x, y}]
     * @param {Object} properties
     * @param {String} properties.color
     * @param {Number} properties.weight
     * @param {String} properties.name
     * @return {string} the id of the new created polyline
     */
    addPolyline(locations,properties) {
        let polylinePoints = [];

        for (let i = 0; i < locations.length; i++) {
            polylinePoints.push(transform([locations[i].x, locations[i].y], 'EPSG:4326', 'EPSG:900913'))
        }

        //create path
        let pathGeometry = new LineString(polylinePoints);
        let feature = new Feature({
            geometry: pathGeometry,
            name: 'Line'
        });
        let source = new VectorSource({
            features: [feature]
        });

        let vectorPathLayer = new VectorLayer({
            title: properties.name,
            source: source,
            style: new Style({
                fill: new Fill({
                    color: properties.color
                }),
                stroke: new Stroke({
                    color: properties.color,
                    width: properties.weight
                })
            })
        });

        this.map.addLayer(vectorPathLayer);

        return vectorPathLayer;
    }

    onResize() {
        super.onResize();
        if(isDefined(this.map) && this.map !== null) {
            this.map.updateSize();
        }
    }
}

export default  OpenLayerView;
