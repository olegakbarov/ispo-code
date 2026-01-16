/**
 * Tasks New Route - /tasks/new
 *
 * Opens the tasks page with the create modal open.
 */

import { createFileRoute } from '@tanstack/react-router'
import { TasksPage } from './_page'

export const Route = createFileRoute('/tasks/new')({
  component: TasksNew,
})

function TasksNew() {
  return (
    <TasksPage
      selectedPath={null}
      createModalOpen={true}
    />
  )
}
