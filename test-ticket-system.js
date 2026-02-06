/**
 * Ticket System Test Script
 * 
 * This script helps verify that the ticket system is properly configured.
 * Run with: node test-ticket-system.js
 */

import { 
  loadPanels, 
  loadTickets, 
  loadTranscripts, 
  loadMeta,
  ensureGuildDir 
} from './ticket-db.js';

// Test guild ID (replace with your actual guild ID for testing)
const TEST_GUILD_ID = 'YOUR_GUILD_ID_HERE';

async function testTicketSystem() {
  console.log('🎫 Testing Ticket System\n');
  console.log('=' .repeat(50));

  try {
    // Test 1: Check if guild directory can be created
    console.log('\n📁 Test 1: Guild Directory Creation');
    try {
      const { ensureGuildDir } = await import('./ticket-db.js');
      await ensureGuildDir(TEST_GUILD_ID);
      console.log('✅ Guild directory can be created');
    } catch (error) {
      console.log('❌ Failed to create guild directory:', error.message);
    }

    // Test 2: Load panels
    console.log('\n📋 Test 2: Load Panels');
    try {
      const panels = await loadPanels(TEST_GUILD_ID);
      console.log(`✅ Panels loaded: ${panels.length} panel(s) found`);
      if (panels.length > 0) {
        console.log('   Panel IDs:', panels.map(p => p.panelId).join(', '));
      } else {
        console.log('   ℹ️  No panels configured yet (this is normal for new setup)');
      }
    } catch (error) {
      console.log('❌ Failed to load panels:', error.message);
    }

    // Test 3: Load tickets
    console.log('\n🎫 Test 3: Load Tickets');
    try {
      const tickets = await loadTickets(TEST_GUILD_ID);
      console.log(`✅ Tickets loaded: ${tickets.length} ticket(s) found`);
      if (tickets.length > 0) {
        const openTickets = tickets.filter(t => t.status === 'open').length;
        const closedTickets = tickets.filter(t => t.status === 'closed').length;
        const approvedTickets = tickets.filter(t => t.status === 'approved').length;
        console.log(`   Open: ${openTickets}, Closed: ${closedTickets}, Approved: ${approvedTickets}`);
      }
    } catch (error) {
      console.log('❌ Failed to load tickets:', error.message);
    }

    // Test 4: Load transcripts
    console.log('\n📝 Test 4: Load Transcripts');
    try {
      const transcripts = await loadTranscripts(TEST_GUILD_ID);
      console.log(`✅ Transcripts loaded: ${transcripts.length} transcript(s) found`);
    } catch (error) {
      console.log('❌ Failed to load transcripts:', error.message);
    }

    // Test 5: Load meta
    console.log('\n🔢 Test 5: Load Meta');
    try {
      const meta = await loadMeta(TEST_GUILD_ID);
      console.log(`✅ Meta loaded: Last ticket ID = ${meta.lastTicketId}`);
    } catch (error) {
      console.log('❌ Failed to load meta:', error.message);
    }

    // Test 6: Import ticket system modules
    console.log('\n📦 Test 6: Module Imports');
    try {
      await import('./ticket-system.js');
      console.log('✅ ticket-system.js imports successfully');
    } catch (error) {
      console.log('❌ Failed to import ticket-system.js:', error.message);
    }

    try {
      await import('./ticket-commands.js');
      console.log('✅ ticket-commands.js imports successfully');
    } catch (error) {
      console.log('❌ Failed to import ticket-commands.js:', error.message);
    }

    try {
      await import('./ticket-utils.js');
      console.log('✅ ticket-utils.js imports successfully');
    } catch (error) {
      console.log('❌ Failed to import ticket-utils.js:', error.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests completed!\n');
    console.log('Next steps:');
    console.log('1. Replace TEST_GUILD_ID in this file with your actual guild ID');
    console.log('2. Run the bot with: npm start');
    console.log('3. In Discord, run: !ticketsetup to configure a panel');
    console.log('4. Run: !applypanel to create the apply button');
    console.log('5. Click the button to test ticket creation\n');

  } catch (error) {
    console.error('❌ Test script error:', error);
  }
}

// Run tests
testTicketSystem().catch(console.error);
