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


import View from "../View.js";
import {isDefined, randomUUID} from "../../../utils/Utils.js";
import Chart from 'chart.js';
import 'chart.js/dist/Chart.min.css';

/**
 * @extends View
 */
class ChartJsView extends View {
    /**
     * Create a View.
     * @param {Object} [properties={}] - the properties of the view
     * @param {String} properties.container - The div element to attach to
     * @param {Object[]}  [properties.layers=[]] - The initial layers to add
     * @param {Object} [properties.datasetsOpts] - chart.js [dataset options]{@link https://www.chartjs.org/docs/latest/charts/line.html#dataset-properties}.
     * @param {Object} [properties.gridLinesOpts] - chart.js [gridline options]{@link https://www.chartjs.org/docs/latest/axes/styling.html#grid-line-configuration}
     * @param {Object} [properties.scaleLabelOpts] - chart.js [scaleLabel options]{@link https://www.chartjs.org/docs/latest/axes/labelling.html#scale-title-configuration}
     * @param {Object} [properties.tickOpts] - chart.js [tick options]{@link https://www.chartjs.org/docs/latest/axes/cartesian/#tick-configuration}
     * @param {Object} [properties.legendOpts] - chart.js [legend options]{@link https://www.chartjs.org/docs/latest/configuration/legend.html?h=legend}
     * @param {Number} [properties.maxPoints] - max points to display before shifting
     * @param {Object} [properties.options] - chart.js [context configuration options]{@link https://www.chartjs.org/docs/latest/configuration}
     */
    constructor(properties) {
        super({
            supportedLayers: ['curve'],
            ...properties
        });

        let xLabel = 'Time';
        let yLabel = 'Values';

        this.datasetsOpts = {};
        this.gridLinesOpts = {};
        this.tickOpts = {};
        this.scaleLabelOpts = {};
        this.legendOpts = {};
        this.options = {};

        if (isDefined(properties)) {
            if(properties.hasOwnProperty('options')){
                this.options = properties.options;
            }
            if(properties.hasOwnProperty('datasetsOpts')){
                this.datasetsOpts = properties.datasetsOpts;
            }

            if(properties.hasOwnProperty('gridLinesOpts')){
                this.gridLinesOpts = properties.gridLinesOpts;
            }

            if(properties.hasOwnProperty('scaleLabelOpts')){
                this.scaleLabelOpts = properties.scaleLabelOpts;
            }

            if(properties.hasOwnProperty('tickOpts')){
                this.tickOpts = properties.tickOpts;
            }

            if(properties.hasOwnProperty('legendOpts')){
                this.legendOpts = properties.legendOpts;
            }

            if (properties.hasOwnProperty('maxPoints')) {
                this.maxPoints = properties.maxPoints;
            }
        }

        let domNode = document.getElementById(this.divId);

        let ctx = document.createElement("canvas");
        ctx.setAttribute("id", randomUUID());
        domNode.appendChild(ctx);

        const { maxTicksLimit } = this.tickOpts || 5;
        this.maxPoints = maxTicksLimit;

        this.chart = new Chart(
            ctx, {
                labels:[],
                type: 'line',
                data: {
                    datasets: []
                },
                options : {
                    legend: {
                        ...this.legendOpts
                    },
                    animation: {
                        duration: 1000
                    },
                    spanGaps: true,
                    scales: {
                        yAxes: [{
                            scaleLabel: {
                                display: true,
                                labelString: yLabel,
                                ...this.scaleLabelOpts,
                            },
                            ticks: {
                                maxTicksLimit:5,
                                ...this.tickOpts
                            },
                            gridLines: this.gridLinesOpts,
                        }],
                        xAxes: [{
                            scaleLabel: {
                                display: true,
                                labelString: xLabel,
                                ...this.scaleLabelOpts,
                            },
                            type: 'time',
                            time: {
                                unit: 'second',
                            },
                            ticks: {
                                maxTicksLimit:5,
                                ...this.tickOpts
                            },
                            gridLines: this.gridLinesOpts,
                        }],
                    },
                    responsive: true,
                    maintainAspectRatio: true,
                    ...this.options
                }
            });

        this.datasets = {};
    }

    setData(dataSourceId, data) {
        if(data.type === 'curve') {
            this.updateCurve(data.values);
        }
    }

    /**
     * Updates the curve associated to the layer.
     * @param {Curve.props[]} props - The layer properties allowing the update of the curve
     */
    updateCurve(props) {
        let currentDataset = this.datasets[props.curveId];
        const values = props.map(item => ({'x': item.x, 'y': item.y}));

        if(!isDefined(currentDataset)) {
            currentDataset = {
                label: props[0].name,
                fillColor: "rgba(220,220,0,0.2)",
                strokeColor: "rgba(220,220,220,1)",
                pointColor: "rgba(220,220,220,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(220,220,220,1)",
                data: values
            };
            currentDataset = {...currentDataset, ...this.datasetsOpts};
            this.datasets[props.curveId] = currentDataset;
            this.chart.data.datasets.push(currentDataset);
        } else {
            values.forEach(value => this.datasets[props.curveId].data.push(value));
        }
        if(currentDataset.data.length >= this.maxPoints) {
            this.chart.options.scales.xAxes[0].ticks.min = this.chart.data.labels[2];
        }
        this.chart.data.labels.push(currentDataset.data[currentDataset.data.length-1].x);
        if(currentDataset.data.length > 1) {
            this.chart.update(0);
        } else {
            this.chart.update();
        }
        if(currentDataset.data.length > this.maxPoints) {
            this.chart.data.labels.shift();
            currentDataset.data.shift();
        }
    }
}

export default ChartJsView;
