/**
 * A layout component for displaying profile content.
 *
 * @param content - The main profile content
 * @param children - The children elements from the containing page
 * @returns The layout component
 */
export function ProfileContentLayout({
  content,
  children,
}: React.PropsWithChildren<{ content?: React.ReactNode }>) {
  return (
    <div className="flex flex-col w-full">
      <div className="flex space-x-2 items-top">{content}</div>
      <div>{children}</div>
    </div>
  );
}
