import type { PostblackApi } from '../../shared/domain'

declare global {
  interface Window {
    postblack: PostblackApi
  }
}

export {}
