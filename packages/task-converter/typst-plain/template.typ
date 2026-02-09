#import "plain.typ": *

// MyST/jtex integration; short_title and show_header optional
#show: template.with(
  title: "[-doc.title-]",
[# if doc.short_title #]
  short-title: "[-doc.short_title-]",
[# endif #]
[# if options.show_header == false #]
  show-header: false,
[# endif #]
)

[-IMPORTS-]

[-CONTENT-]
