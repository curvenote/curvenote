#import "plain.typ": *

// MyST/jtex integration; short_title, show_header, logo, header_text optional
#show: template.with(
  title: "[-doc.title-]",
[# if options.header_text #]
  short-title: "[-options.header_text-]",
[# elseif doc.short_title #]
  short-title: "[-doc.short_title-]",
[# endif #]
[# if options.show_header == false #]
  show-header: false,
[# endif #]
[# if options.logo #]
  logo: "[-options.logo-]",
[# endif #]
)

[-IMPORTS-]

[-CONTENT-]
