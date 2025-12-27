import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
const db = new Database(dbPath);

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    url TEXT NOT NULL,
    last_rank INTEGER,
    last_checked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS keyword_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id INTEGER NOT NULL,
    rank INTEGER,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(keyword_id) REFERENCES keywords(id)
  );
`);

export interface Keyword {
  id: number;
  keyword: string;
  url: string;
  last_rank: number | null;
  last_checked_at: string | null;
  created_at: string;
}

export interface KeywordRanking {
  id: number;
  keyword_id: number;
  rank: number;
  checked_at: string;
}

export interface JoinedRanking {
  id: number;
  rank: number;
  checked_at: string;
  keyword: string;
  url: string;
}

// Data Access Object
export const dbOps = {
  // ... existing methods ...
  addKeyword: (keyword: string, url: string) => {
    const stmt = db.prepare('INSERT INTO keywords (keyword, url) VALUES (?, ?)');
    return stmt.run(keyword, url);
  },

  addKeywordsBulk: (items: {keyword: string, url: string}[]) => {
    const insert = db.prepare('INSERT INTO keywords (keyword, url) VALUES (?, ?)');
    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(row.keyword, row.url);
      }
    });
    return transaction(items);
  },

  deleteKeywordsBulk: (ids: number[]) => {
    const deleteRankings = db.prepare('DELETE FROM keyword_rankings WHERE keyword_id = ?');
    const deleteKeyword = db.prepare('DELETE FROM keywords WHERE id = ?');
    
    const transaction = db.transaction((idsToDelete) => {
      for (const id of idsToDelete) {
        deleteRankings.run(id); // Delete related rankings first (foreign key)
        deleteKeyword.run(id);
      }
    });
    return transaction(ids);
  },

  getAllRankings: (): JoinedRanking[] => {
    const stmt = db.prepare(`
      SELECT 
        r.id, r.rank, r.checked_at,
        k.keyword, k.url
      FROM keyword_rankings r
      JOIN keywords k ON r.keyword_id = k.id
      ORDER BY r.checked_at DESC
    `);
    return stmt.all() as JoinedRanking[];
  },


  getKeywords: (): Keyword[] => {
    const stmt = db.prepare('SELECT * FROM keywords ORDER BY created_at DESC');
    return stmt.all() as Keyword[];
  },

  addRanking: (keywordId: number, rank: number | null) => {
    const transaction = db.transaction(() => {
      const insertStmt = db.prepare('INSERT INTO keyword_rankings (keyword_id, rank) VALUES (?, ?)');
      insertStmt.run(keywordId, rank);

      const updateStmt = db.prepare('UPDATE keywords SET last_rank = ?, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?');
      updateStmt.run(rank, keywordId);
    });
    return transaction();
  },

  getRankings: (keywordId: number): KeywordRanking[] => {
    const stmt = db.prepare('SELECT * FROM keyword_rankings WHERE keyword_id = ? ORDER BY checked_at DESC');
    return stmt.all(keywordId) as KeywordRanking[];
  }
};

export default db;
