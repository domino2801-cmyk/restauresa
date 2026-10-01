import { isEmail, validateRegistration } from './validation'

const valid = {
  regiment_id: 'r',
  company_id: 'c',
  section_id: 's',
  fullName: 'Durand',
  email: 'durand@example.fr',
  password: 'motdepasse',
  confirm: 'motdepasse',
}

describe('validation', () => {
  it('reconnaît les emails', () => {
    expect(isEmail(' a@b.fr ')).toBe(true)
    expect(isEmail('Durand')).toBe(false)
  })

  it('accepte un formulaire complet', () => {
    expect(validateRegistration(valid)).toEqual({})
  })

  it('exige tous les champs obligatoires', () => {
    const errors = validateRegistration({
      ...valid,
      regiment_id: null,
      company_id: null,
      section_id: null,
      fullName: ' ',
      email: 'x',
      password: 'court',
      confirm: 'autre',
    })
    expect(Object.keys(errors).sort()).toEqual(
      ['company_id', 'confirm', 'email', 'fullName', 'password', 'regiment_id', 'section_id'].sort(),
    )
  })
})
