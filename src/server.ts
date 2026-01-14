import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import './streams/init' // Auto-initialize streams server

const fetch = createStartHandler(defaultStreamHandler)

export default { fetch }
