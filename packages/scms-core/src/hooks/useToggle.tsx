import { useState } from 'react';

export default function useToggle(defaultChecked?: boolean) {
  const [toggle, setToggle] = useState(defaultChecked || false);

  return {
    toggle,
    onToggle: () => setToggle((t) => !t),
    onOpen: () => setToggle(true),
    onClose: () => setToggle(false),
    setToggle,
  };
}
