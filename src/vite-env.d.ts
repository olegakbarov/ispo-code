/// <reference types="vite/client" />

// Vite asset imports with ?url suffix
declare module '*.css?url' {
  const url: string
  export default url
}

declare module '*.svg?url' {
  const url: string
  export default url
}

declare module '*.png?url' {
  const url: string
  export default url
}

declare module '*.jpg?url' {
  const url: string
  export default url
}
