import classNames from 'classnames';

export function SiteLogo({
  alt,
  logo,
  logo_dark,
  className = 'object-cover h-10',
}: {
  alt?: string;
  logo?: string;
  logo_dark?: string;
  className?: string;
}) {
  return (
    <>
      {logo_dark && (
        <img src={logo_dark} alt={alt} className={classNames(className, 'hidden dark:block')} />
      )}
      <img
        src={logo}
        alt={alt}
        className={classNames(className, {
          'dark:hidden': logo_dark,
          'dark:grayscale': !logo_dark,
        })}
      />
    </>
  );
}
