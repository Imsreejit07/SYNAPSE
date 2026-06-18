import React from 'react';
import AnalogJunctionNode from './AnalogJunctionNode';
import DigitalGateNode from './DigitalGateNode';
import SpiceComponentNode from './SpiceComponentNode';

export default function PolymorphicNodeFactory(props) {
  const { data } = props;
  switch (data.engine) {
    case 'SYNAPSE_DIGITAL_v2.1':
      return <DigitalGateNode {...props} />;
    case 'LEGACY_SPICE_v1.0':
      return <SpiceComponentNode {...props} />;
    case 'SYNAPSE_ANALOG_v3.0':
    default:
      return <AnalogJunctionNode {...props} />;
  }
}
