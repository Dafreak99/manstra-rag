import postgres from 'postgres'
import { env } from '../config/env.js'

/**
 * Script to inspect Mastra's database structure
 * 
 * Shows:
 * - All tables created by Mastra
 * - Table schemas and columns
 * - Sample data from memory tables
 * - How messages are stored
 */

async function inspectDatabase() {
  if (!env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }

  const sql = postgres(env.DATABASE_URL)

  try {
    console.log('🔍 Inspecting Mastra Database Structure...\n')
    console.log('=' .repeat(80))

    // Get all tables
    const tables = await sql`
      SELECT 
        table_name,
        table_schema
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `

    console.log('\n📊 Tables in Database:\n')
    for (const table of tables) {
      console.log(`  - ${table.table_name}`)
    }

    // Inspect each Mastra table
    const mastraTables = tables.filter((t: any) => 
      t.table_name.startsWith('mastra_') || 
      t.table_name.includes('memory') ||
      t.table_name.includes('message') ||
      t.table_name.includes('thread') ||
      t.table_name.includes('resource')
    )

    if (mastraTables.length === 0) {
      console.log('\n⚠️  No Mastra-specific tables found. Mastra may use generic table names.')
      console.log('   Checking all tables for structure...\n')
    }

    // Get detailed schema for each table
    for (const table of tables) {
      const tableName = table.table_name
      
      console.log(`\n${'='.repeat(80)}`)
      console.log(`📋 Table: ${tableName}`)
      console.log('='.repeat(80))

      // Get columns
      const columns = await sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        ORDER BY ordinal_position
      `

      console.log('\nColumns:')
      for (const col of columns) {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : ''
        console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`)
      }

      // Get row count
      const countResult = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`
      const count = countResult[0]?.count || 0
      console.log(`\nRow count: ${count}`)

      // Show sample data (first 3 rows)
      if (count > 0) {
        console.log('\nSample data (first 3 rows):')
        try {
          const sample = await sql`SELECT * FROM ${sql(tableName)} LIMIT 3`
          console.log(JSON.stringify(sample, null, 2))
        } catch (error) {
          console.log(`  (Could not fetch sample: ${error instanceof Error ? error.message : 'Unknown error'})`)
        }
      }
    }

    // Check for pgvector extension
    console.log(`\n${'='.repeat(80)}`)
    console.log('🔍 Checking pgvector extension...')
    try {
      const extensions = await sql`
        SELECT * FROM pg_extension WHERE extname = 'vector'
      `
      if (extensions.length > 0) {
        console.log('✅ pgvector extension is installed')
      } else {
        console.log('⚠️  pgvector extension not found')
      }
    } catch (error) {
      console.log(`⚠️  Could not check extensions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Check for vector columns
    console.log(`\n${'='.repeat(80)}`)
    console.log('🔍 Checking for vector columns...')
    try {
      const vectorColumns = await sql`
        SELECT 
          table_name,
          column_name,
          data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'USER-DEFINED'
          AND udt_name = 'vector'
      `
      if (vectorColumns.length > 0) {
        console.log('\nVector columns found:')
        for (const col of vectorColumns) {
          console.log(`  - ${col.table_name}.${col.column_name}`)
        }
      } else {
        console.log('⚠️  No vector columns found (semantic recall may not be storing embeddings yet)')
      }
    } catch (error) {
      console.log(`⚠️  Could not check vector columns: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

  } catch (error) {
    console.error('❌ Error inspecting database:', error)
  } finally {
    await sql.end()
  }
}

inspectDatabase()

