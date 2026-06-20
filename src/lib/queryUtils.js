export async function comTimeout(promessa, ms = 12000) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('A consulta demorou demais. Verifique sua conexão.')),
      ms,
    )
  })
  try {
    return await Promise.race([promessa, timeout])
  } finally {
    clearTimeout(timer)
  }
}
