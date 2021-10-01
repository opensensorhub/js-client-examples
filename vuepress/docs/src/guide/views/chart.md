# Chart

The Chart view allows the data to be displayed as a Chart using the [Chart.js](https://www.chartjs.org/) library.

For the moment, the view only supports the [Line](https://www.chartjs.org/docs/3.5.1/charts/line.html) chart type.

<DocumentationLoad path="/guide/api/ChartJsView.html"/>

## Properties configuration

This View is highly configurable. Chart.js is built using a property object. This object can be directly passed, in part or in full,
depending on what you want to configure, to the ChartView which will in turn forward it to the Deck object.

The ***options*** allows to modify the native chart.js properties by passing a global chart
[configuration object](https://www.chartjs.org/docs/3.5.1/configuration/).

The ***datasetsOptions*** allows to modify the native [datasets properties](https://www.chartjs.org/docs/3.5.1/configuration/).

Then a deep merge is processed and passed as a properties object of the Chart.js object.
When you pass one of these options to the ChartView, the properties will be merged with the defaults.

The default ***options*** are:

<<< @/../../source/core/ui/view/chart/ChartJsView.js#snippet_chartjsview_default_chartprops

## Supported layers

The view supports type layers:
- curve

## Packaging

This new version of chart.js need some package to work, here a piece of code of the package.json:

```json
    "chart.js": "3.5.1",
    "chartjs-adapter-moment": "1.0.0",
    "moment": "2.29.1"
```

## Example

<<< @/../../showcase/examples/chart/chart.js

<hr class="demo-hr"/>
<br/><br/>

<Example path="/showcase/chart.html" style="border:none;width:100%;height: 500px" />

