// Matches the Scrollama approach in DSC 106 Lab 8.
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// No datasets or sliders yet. These labels are placeholders for our 3 metrics.
const metrics = [
  { title: 'Climate comfort', color: '#e68a50', description: 'Preview: climate metric selected.' },
  { title: 'Housing affordability', color: '#328aa7', description: 'Preview: housing metric selected.' },
  { title: 'Population density', color: '#8265b0', description: 'Preview: density metric selected.' },
];

// Simple D3 placeholder: markers are NOT real cities or a geographic map.
const svg = d3.select('#demo-viz');
const points = [
  { x: 148, y: 135, label: 'Climate' },
  { x: 340, y: 108, label: 'Housing' },
  { x: 438, y: 250, label: 'Density' },
];

// A light abstract grid visually reserves the space where the map will go.
svg.selectAll('.grid-v')
  .data(d3.range(40, 600, 40))
  .join('line')
  .attr('x1', d => d).attr('x2', d => d)
  .attr('y1', 0).attr('y2', 370)
  .attr('stroke', '#d8e5ed');

svg.selectAll('.grid-h')
  .data(d3.range(40, 370, 40))
  .join('line')
  .attr('x1', 0).attr('x2', 600)
  .attr('y1', d => d).attr('y2', d => d)
  .attr('stroke', '#d8e5ed');

const markers = svg.selectAll('.demo-point')
  .data(points)
  .join('circle')
  .attr('class', 'demo-point')
  .attr('cx', d => d.x)
  .attr('cy', d => d.y)
  .attr('stroke', 'white')
  .attr('stroke-width', 4);

svg.selectAll('.marker-label')
  .data(points)
  .join('text')
  .attr('class', 'marker-label')
  .attr('x', d => d.x)
  .attr('y', d => d.y + 63)
  .attr('text-anchor', 'middle')
  .attr('font-size', 19)
  .attr('font-weight', 650)
  .attr('fill', '#577083')
  .text(d => d.label);

function updateStep(index) {
  const selected = metrics[index];

  d3.selectAll('#story .step').classed('is-active', (d, i) => i === index);
  d3.select('#step-counter').text(`${String(index + 1).padStart(2, '0')} / 03`);
  d3.select('#graphic-title').text(selected.title);
  d3.select('#graphic-description').text(selected.description);

  // This is the part that will update the real map later.
  markers.interrupt().transition().duration(450)
    .attr('r', (d, i) => i === index ? 31 : 18)
    .attr('fill', (d, i) => i === index ? selected.color : '#b7c9d4')
    .attr('opacity', (d, i) => i === index ? 1 : .65);
}

updateStep(0);

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly',
    step: '#story .step',
    offset: 0.55,
  })
  .onStepEnter(({ index }) => updateStep(index));

window.addEventListener('resize', () => scroller.resize());
