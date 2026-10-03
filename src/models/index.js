import { buildJet } from './jet.js';
import { buildRadial } from './radial.js';
import { buildCar } from './car.js';
import { buildBrain } from './brain.js';

// view = starting rotation (radians). parts are built lazily the first time a model is shown.
export const MODELS = [
  {
    id: 'jet',
    name: 'Turbofan Jet Engine',
    category: 'Machines',
    subtitle: 'Fan, compressors, combustor, turbines, nozzle',
    view: { x: 0.28, y: -0.55, z: 0 },
    build: buildJet,
  },
  {
    id: 'radial',
    name: 'Radial Aircraft Engine',
    category: 'Machines',
    subtitle: 'Nine cylinders around one crankshaft',
    view: { x: 0.35, y: 0.55, z: 0 },
    build: buildRadial,
  },
  {
    id: 'car',
    name: 'Sports Car',
    category: 'Machines',
    subtitle: 'Body, chassis, drivetrain and interior',
    view: { x: 0.3, y: -0.7, z: 0 },
    build: buildCar,
  },
  {
    id: 'brain',
    name: 'Human Brain',
    category: 'Biology',
    subtitle: 'Lobes, cerebellum and the structures inside',
    view: { x: 0.18, y: 0.7, z: 0 },
    build: buildBrain,
  },
];
