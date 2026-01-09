export function OrDivider() {
  return (
    <div className="flex gap-2 items-center w-full">
      <div className="w-full h-[1px] bg-stone-400 dark:bg-stone-600" />
      <div className="px-2 font-light bg-inherit text-stone-600 dark:text-stone-400">or</div>
      <div className="w-full h-[1px] bg-stone-400 dark:bg-stone-600" />
    </div>
  );
}
