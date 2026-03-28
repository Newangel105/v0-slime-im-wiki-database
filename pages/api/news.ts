import type { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { region = '3', language = '2' } = req.query
  const apiUrl = `https://api-us.ten-sura-m.wfs.games/web/announcement?region=${region}&language=${language}`
  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' })
  }
}
