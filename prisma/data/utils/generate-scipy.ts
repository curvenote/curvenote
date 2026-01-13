import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import works from './generate-works';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateSciPyJson() {
  const scipyData = {
    url: 'https://scipy.curve.space',
    private: false,
    site: {
      id: 'd872a7c4-19e0-48f5-9c0b-051950a01878',
      name: 'scipy',
      default_workflow: 'SIMPLE',
      title: 'SciPy Proceedings',
      description: 'Proceedings of the Python in Science Conferences',
      favicon: 'https://cdn.curvenote.com/static/site/scipy/favicon.ico',
      tagline: '',
      content: 'scipy-landingstaging.curve.space',
      logo: 'https://cdn.curvenote.com/static/site/scipy/scipy-logo.svg',
      logo_dark: 'https://cdn.curvenote.com/static/site/scipy/scipy-logo-lightblue.svg',
      footer_logo: 'https://cdn.curvenote.com/static/site/scipy/scipy-logo-footer.svg',
      footer_logo_dark: 'https://cdn.curvenote.com/static/site/scipy/scipy-logo-footer.svg',
      slug_strategy: 'DOI',
      footer_links: [
        [
          { url: '/', title: 'Home' },
          { url: '/articles', title: 'Latest Articles' },
          { url: '/archive', title: 'Archive' },
          { url: '/past-conferences', title: 'Past Conferences' },
          { url: '/news', title: 'News' },
        ],
        [
          { url: '/submit', title: 'Submit An Article' },
          { url: '/getting-started', title: 'Author Instructions' },
        ],
      ],
      social_links: [
        { kind: 'twitter', url: 'https://twitter.com/SciPyConf' },
        { kind: 'github', url: 'https://github.com/scipy-conference' },
      ],
      kinds: [
        {
          name: 'article',
          content: {
            title: 'Article',
            description: 'A research article',
          },
          default: true,
          checks: [
            { id: 'abstract-exists' },
            { id: 'abstract-length' },
            { id: 'authors-exist' },
            { id: 'authors-corresponding' },
            { id: 'authors-have-affiliations' },
            { id: 'authors-have-orcid', optional: true },
            { id: 'authors-have-credit-roles' },
            { id: 'data-availability-exists' },
            { id: 'keywords-defined', optional: true },
            { id: 'keywords-length' },
            { id: 'keywords-unique' },
            { id: 'links-resolve' },
            { id: 'abstract-exists' },
            { id: 'doi-exists' },
          ],
        },
      ],
      theme_config: {
        grid: 'article-left-grid',
        name: 'theme-one',
        colors: {
          primary: '#0154a5',
        },
        fonts: {
          one: {
            name: 'Monserrat',
            src: 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap',
          },
        },
        styles: {
          footer: 'bg-primary dark:bg-stone-700 text-primary-contrast dark:text-white',
        },
        content: {
          tableOfContents: true,
          navigationBanner: false,
        },
        jupyter: {
          mecaBundle: true,
          launchBinder: true,
          figureCompute: true,
          notebookCompute: true,
          binderUrlOverride: 'https://xhrtcvh6l53u.curvenote.dev/services/binder/',
        },
        landing: {
          grid: 'article-grid',
          hero: {
            cta: [
              {
                url: '/2023',
                icon: 'doc-chart',
                label: 'Read 2023 Abstracts',
                classes:
                  'inline-block px-8 py-4 rounded-lg bg-white text-black no-underline text-lg font-light tracking-wide border-1 border-white hover:opacity-90',
                openInNewTab: false,
              },
              {
                url: 'https://www.scipy2024.scipy.org/',
                label: 'SciPy Conference',
                classes:
                  'inline-block px-8 py-4 rounded-lg bg-transparent border-1 text-white no-underline text-lg font-light tracking-wide hover:bg-gray-50/10',
                openInNewTab: true,
              },
            ],
            title: 'Python in Science Conferences',
            layout: 'left',
            classes: {
              text: 'text-primary-contrast font-one',
              heading: 'text-5xl font-extralight text-white tracking-tight',
              kicker: 'font-regular text-lg',
              description: 'font-extralight text-xl leading-8',
              backgroundScreen: 'bg-black bg-opacity-50 lg:hidden',
            },
            kicker: 'THE PROCEEDINGS',
            description:
              'The SciPy Conference is a cross-disciplinary gathering focused on the use and development of the Python language in scientific research. This event strives to bring together both users and developers of scientific tools, as well as academic research and state of the art industry.',
            backgroundImage: 'https://cdn.curvenote.com/static/site/scipy/scipy-hero-v2-tilt.webp',
          },
          listing: 'list',
          listingTitle: '2023 Proceedings',
          listingActionText: 'See All Proceedings',
        },
        listing: {
          type: 'list',
        },
        articles: {
          tableOfContents: false,
          supportingDocuments: true,
        },
        manifest: {
          nav: [
            { url: '/', title: 'Home' },
            { url: '/articles', title: 'Proceedings' },
            { url: 'https://conference.scipy.org/proceedings', title: 'Archive' },
            { url: 'https://www.scipy2024.scipy.org', title: '2024 Conference' },
          ],
        },
        submission: false,
      },
    },
    collections: [
      {
        name: 'articles',
        slug: '',
        workflow: 'SIMPLE',
        default: false,
        open: false,
        content: {
          title: 'Articles',
          description: 'A collection of research articles',
        },
      },
      {
        name: '2024',
        slug: '2024',
        workflow: 'SIMPLE',
        default: false,
        open: true,
        content: {
          title: '2024 Research Articles',
          description: 'A collection of research articles for 2024',
        },
      },
      {
        name: '2023',
        slug: '2023',
        workflow: 'SIMPLE',
        default: false,
        open: false,
        content: {
          title: '2023 Research Articles',
          description: 'A collection of research articles for 2023',
        },
      },
    ],
    works,
  };

  // Write the file
  await fs.writeFile(path.join(__dirname, '..', 'scipy.json'), JSON.stringify(scipyData, null, 2));
}

generateSciPyJson().catch(console.error);
