#!/usr/bin/env npx tsx

import { aiService } from '../src/lib/ai-service';

async function testUrlRejection() {
  console.log('Testing URL rejection in article suggestions...\n');

  const testCases = [
    {
      name: 'Valid suggestion without URL',
      suggestionDetails: 'Please add more examples about using async/await with error handling',
      shouldPass: true
    },
    {
      name: 'Suggestion with http URL',
      suggestionDetails: 'Please add a link to http://example.com for more information',
      shouldPass: false
    },
    {
      name: 'Suggestion with https URL',
      suggestionDetails: 'Check out this resource at https://docs.example.com/guide',
      shouldPass: false
    },
    {
      name: 'Suggestion with www URL',
      suggestionDetails: 'You should reference www.example.com in the article',
      shouldPass: false
    },
    {
      name: 'Suggestion with domain-like text',
      suggestionDetails: 'Add information from example.com to improve the content',
      shouldPass: false
    },
    {
      name: 'Suggestion with URL in middle of text',
      suggestionDetails: 'The article is missing info from https://github.com/example/repo which would help',
      shouldPass: false
    },
    {
      name: 'Reference to check out a website',
      suggestionDetails: 'You should check out the documentation on their website for more details',
      shouldPass: false
    },
    {
      name: 'Reference to GitHub',
      suggestionDetails: 'Add the example from the GitHub repository',
      shouldPass: false
    },
    {
      name: 'Reference to Stack Overflow',
      suggestionDetails: 'There is a better solution on Stack Overflow that should be included',
      shouldPass: false
    },
    {
      name: 'Suggestion to visit a resource',
      suggestionDetails: 'Users should visit the official documentation site',
      shouldPass: false
    },
    {
      name: 'Reference with "refer to"',
      suggestionDetails: 'Please refer to the Mozilla documentation',
      shouldPass: false
    },
    {
      name: 'Valid suggestion about cloud deployment',
      suggestionDetails: 'Explain how to deploy applications to cloud providers',
      shouldPass: true
    },
    {
      name: 'Valid suggestion about documentation',
      suggestionDetails: 'Add a section explaining how to write better documentation',
      shouldPass: true
    },
    {
      name: 'Valid code improvement',
      suggestionDetails: 'The error handling in the example could be improved by adding try-catch blocks',
      shouldPass: true
    },
    {
      name: 'Edge case: email-like but not URL',
      suggestionDetails: 'Add an example showing user@example syntax for SSH',
      shouldPass: true
    }
  ];

  const mockArticle = {
    title: 'Introduction to Node.js',
    content: '# Introduction to Node.js\n\nNode.js is a JavaScript runtime...'
  };

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`Suggestion: "${testCase.suggestionDetails}"`);
    
    try {
      const result = await aiService.validateArticleSuggestion(
        mockArticle.title,
        mockArticle.content,
        'CONTENT_ADDITION',
        testCase.suggestionDetails,
        'test-user-id'
      );

      const passed = result.isValid === testCase.shouldPass;
      
      if (!result.isValid && !testCase.shouldPass) {
        console.log(`✅ PASSED - Correctly rejected: ${result.reason}`);
      } else if (result.isValid && testCase.shouldPass) {
        console.log(`✅ PASSED - Correctly accepted`);
      } else {
        console.log(`❌ FAILED - Expected ${testCase.shouldPass ? 'accept' : 'reject'} but got ${result.isValid ? 'accept' : 'reject'}`);
        console.log(`   Reason: ${result.reason}`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error}`);
    }
  }
}

// Run the test
testUrlRejection().catch(console.error);