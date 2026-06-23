import { OperatorToggle } from 'codeshore';

const noop = () => {};

export const And = () => (
  <div style={{ width: 140 }}>
    <OperatorToggle value="and" onChange={noop} />
  </div>
);

export const Or = () => (
  <div style={{ width: 140 }}>
    <OperatorToggle value="or" onChange={noop} />
  </div>
);
