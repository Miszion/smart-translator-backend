import OpenAI from 'openai';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { APIGatewayProxyEvent, APIGatewayProxyCallback} from 'aws-lambda';
import { SECRET_NAME } from './commons';

const getResponse = async (client: OpenAI, text: string, context: string) => {
  const response = await client.chat.completions.create({
    messages: [{ role: 'system', content: context}, { role: 'user', content: text}],
    model: 'gpt-4o-mini'
  });
  return response.choices[0].message.content;
}

const callSecretsManager = async () => {
  const client = new SecretsManagerClient({
    region: 'us-east-1',
  });
  
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: SECRET_NAME,
        VersionStage: 'AWSCURRENT', // VersionStage defaults to AWSCURRENT if unspecified
      })
    );
    return response;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

const getGPTClient = async () => {
  const secrets = await callSecretsManager();
  const secretString = JSON.parse(secrets.SecretString);

  const organization = secretString['organization']
  const project = secretString['project']
  const apiKey = secretString['apiKey']

  return new OpenAI({
    organization: organization,
    project: project,
    apiKey: apiKey
  });
}

export const callOpenAI = async (event: APIGatewayProxyEvent, context: any, callback: APIGatewayProxyCallback) => {
  const client = await getGPTClient();

  try {
    const body = JSON.parse(event.body);
    const response = await getResponse(client, body.text, body.context);
    return {
      statusCode: 200,
      body: JSON.stringify({
        response: response
      }),
    };
  } catch(error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        response: 'An unexpected error has occurred. Please try again later'
      }),
    };
  }
};