import { ExternalLink, Calendar, User } from 'lucide-react';
import { ui, primitives } from '@curvenote/scms-core';
import type { EditorProject } from './db.server';

export function EditorProjectsList({ projects }: { projects: EditorProject[] }) {
  const renderProject = (project: EditorProject) => (
    <a
      key={project.id}
      href={project.links.html}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-shadow hover:shadow-md"
    >
      <primitives.Card className="p-4 cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {project.name}
              </h3>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Modified {new Date(project.date_modified).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>Created {new Date(project.date_created).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400">
            <ExternalLink className="w-4 h-4" />
            Open
          </div>
        </div>
      </primitives.Card>
    </a>
  );

  const searchComponent = (searchTerm: string, setSearchTerm: (term: string) => void) => (
    <div className="mb-4">
      <input
        type="text"
        placeholder="Search projects..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
    </div>
  );

  const filterItems = (items: EditorProject[], searchTerm: string) => {
    if (!searchTerm) return items;

    const lowerSearchTerm = searchTerm.toLowerCase();
    return items.filter((project) => project.name.toLowerCase().includes(lowerSearchTerm));
  };

  return (
    <div>
      <ui.ClientFilterableList
        items={projects}
        filters={[]} // No filtering needed - just search
        renderItem={renderProject}
        searchComponent={searchComponent}
        filterItems={filterItems}
        // error={error || undefined}
        emptyMessage="No projects found. Create your first project to get started!"
        className="space-y-4"
      />
    </div>
  );
}
