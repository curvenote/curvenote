import { Container } from '@curvenote/scms-core';
import { format } from 'date-fns';

export function Footer() {
  const year = format(new Date(), 'yyyy');
  return (
    <footer className="h-[32px] bg-curvenote-blue">
      <Container className="flex items-center justify-center h-full">
        <p className="text-sm text-stone-200">©{year} Curvenote inc. All rights reserved.</p>
      </Container>
    </footer>
  );
}
