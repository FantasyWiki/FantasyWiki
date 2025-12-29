// typescript
import { mount } from '@vue/test-utils'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import NavBar from "../../src/layout/NavBar.vue";

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush })
}))

describe('NavBar.vue', () => {
  let wrapper: any

  beforeEach(() => {
    mockPush.mockClear()
    wrapper = mount(NavBar, {
      global: {
      }
    })
  })

  afterEach(() => {
    wrapper.unmount()
  })

  test('renders logo and dashboard link', () => {
    expect(wrapper.text()).toContain('FantasyWiki')
    expect(wrapper.text()).toContain('Dashboard')
  })

//   test('navigates home when clicking logo', async () => {
//     await wrapper.find('.logo-container').trigger('click')
//     expect(mockPush).toHaveBeenCalledWith('/')
//   })
 })

