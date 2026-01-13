export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-12 space-y-1">
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="text-xl font-light">{description}</p>
    </div>
  );
}
