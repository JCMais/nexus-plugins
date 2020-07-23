import { hello } from '../src/index'

describe('sample', () => {
  it('hello', () => {
    expect(hello()).toEqual('world')
  })
})
