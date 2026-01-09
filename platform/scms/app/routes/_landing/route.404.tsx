import { ui, Container } from '@curvenote/scms-core';

export default function Page404() {
  return (
    <section className="">
      <Container className="flex items-center justify-center h-screen">
        <div className="space-y-8 text-center">
          <h1 className="text-6xl text-blue-900 lg:pb-5 lg:text-9xl">404</h1>
          <h2 className="lg:text-6xl">Page not found.</h2>
          <p className="max-w-xl text-lg">
            The page you are looking for doesn't exist or has been moved. Please go back to the
            homepage.
          </p>
          <ui.Button size="lg" asChild>
            <a href="/">Go back home</a>
          </ui.Button>
        </div>
      </Container>
    </section>
  );
}
