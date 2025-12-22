import { ui, Container } from '@curvenote/scms-core';

export default function Page404() {
  return (
    <section className="">
      <Container className="flex items-center justify-center h-screen pt-32">
        <div className="space-y-8 text-center">
          <h1 className="text-6xl text-blue-900 lg:pb-5 lg:text-9xl">500</h1>
          <h2 className="lg:text-6xl">Internal Server Error</h2>
          <p className="max-w-xl text-lg">There was an error, please try again later.</p>
          <ui.Button size="lg" asChild>
            <a href="/">Go back home</a>
          </ui.Button>
        </div>
      </Container>
    </section>
  );
}
