const DATABASE = 'musicaldirector-audio'
const STORE = 'files'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveMusicFile(key: string, file: File): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(file, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function loadMusicFile(key: string): Promise<Blob | undefined> {
  const db = await openDatabase()
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly')
    const request = transaction.objectStore(STORE).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return blob
}

export async function deleteMusicFile(key: string): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function musicDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const audio = new Audio(url)
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0)
      audio.onerror = () => reject(new Error('无法读取音乐文件'))
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
