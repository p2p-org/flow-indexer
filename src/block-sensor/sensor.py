import json
import requests
import time
import pika
import os
from dotenv import load_dotenv
from pino import pino

load_dotenv()

logger = pino(
    bindings={
        "level": os.environ.get("LOG_LEVEL"),
        "name": os.environ.get('NETWORK')
    }
)

rpc_uri = os.environ.get("RPC_URI")
queue_name = os.environ.get('RABBITMQ_QUEUE_BLOCK_SENSOR')
channel=None

def connectToRabbitMQ():
    global channel

    parameters = pika.URLParameters(os.environ.get('RABBITMQ'))
    try:
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        channel.queue_declare(queue=queue_name, durable=True)
    except:
        logger.error("RabbitMQ connection problem")


def sendMessageToRabbitMQ(message: json):
    global channel

    if channel is None:
        connectToRabbitMQ()
    
    try: 
        channel.basic_publish(exchange='', routing_key=queue_name, body=json.dumps(message))
    except:
        connectToRabbitMQ()
        

def fetchLastBlock():
    try:
        response = requests.get(f'{rpc_uri}/v1/blocks?height=sealed')
        if response.status_code == 200:
            json_data = json.loads(response.content)
            return int(json_data[0]['header']['height'])
        else:
            logger.error(f'Response status is {response.status_code}')
    except requests.exceptions.ConnectionError:
        logger.error("Connection error occurred")
        logger.error("Please check connection or the server's availability.")


prev_block_height = 0
while (1):
    last_block_height = fetchLastBlock()
    if (last_block_height and prev_block_height != last_block_height):
        prev_block_height = last_block_height
        logger.info(f'Last block height {last_block_height}')
        sendMessageToRabbitMQ({'entity_id': last_block_height})

    time.sleep(1)
