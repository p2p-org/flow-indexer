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

# Init RabbitMQ conenction
time.sleep(10)
parameters = pika.URLParameters(os.environ.get('RABBITMQ'))
connection = pika.BlockingConnection(parameters)
channel = connection.channel()
queue_name = os.environ.get('RABBITMQ_QUEUE_BLOCK_SENSOR')
channel.queue_declare(queue=queue_name, durable=True)


def sendMessageToQueue(message: json):
    channel.basic_publish(
        exchange='',
        routing_key=queue_name,
        body=json.dumps(message)
    )


def fetch_new_blocks():
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
    last_block_height = fetch_new_blocks()
    if (last_block_height and prev_block_height != last_block_height):
        prev_block_height = last_block_height
        logger.info(f'Last block height {last_block_height}')
        sendMessageToQueue({'entity_id': last_block_height})

    time.sleep(1)
