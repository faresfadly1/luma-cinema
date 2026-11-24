import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {pool} from './db.js';
try{const sql=await readFile(resolve(process.cwd(),'server/migrations/001_init.sql'),'utf8');await pool.query(sql);console.log('Database migration complete.');}finally{await pool.end();}
