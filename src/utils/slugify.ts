export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 80)
}

export const buildProductUrl = (product: {
  name: string
  id: string
  product_code?: string
}) => {
  const nameSlug = slugify(product.name)
  const codeSlug = product.product_code
    ? `-${slugify(product.product_code)}`
    : ''
  const shortId = product.id.substring(0, 8)
  return `/product/${nameSlug}${codeSlug}--${shortId}`
}

export const isUUID = (str: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}
