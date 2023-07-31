import json
import requests
import base64
import sys
import pika
import time
import os
from typing import Any, Dict
from dotenv import load_dotenv
from pino import pino

load_dotenv()

logger = pino(
    bindings={"level": os.environ.get("LOG_LEVEL"), "name": os.environ.get('NETWORK')}
)

rpc_uri = os.environ.get("RPC_URI")


def fetch_block_data(block_height: int):
    """
    Fetch block metadata, all block transactions and events from the Flow RPC node
    """

    logger.info(f'Fetching block with height: {block_height}')
    try:
        response = requests.get(f'{rpc_uri}/v1/blocks?height={block_height}&expand=payload,execution_result')

        logger.info(f'{rpc_uri}/v1/blocks?height={block_height}&expand=payload,execution_result')
        block_data = {}
        if response.status_code == 200:
            json_data = json.loads(response.content)
            block_data = json_data[0]

        return_data = {
            "entity_id": block_data['header']['height'],
            "block": {
                "block_height": block_data['header']['height'],
                "block_id": block_data['header']['id'],
                "parent_id": block_data['header']['parent_id'],
                "block_time": block_data['header']['timestamp'],
                "parent_voter_signature": block_data['header']['parent_voter_signature']
            },
            "transactions": [],
            "events": []
        }

        # ---------------- TRANSACTIONS --------------------------
        for transaction_payload in block_data["payload"]["collection_guarantees"]:
            tr_response = requests.get(f'{rpc_uri}/v1/collections/{transaction_payload["collection_id"]}?expand=transactions')
            if tr_response.status_code == 200:
                tr_json_data = json.loads(tr_response.content)
                transaction_data = {
                    "id": tr_json_data["id"],
                    "transactions": []
                }

                for transaction in tr_json_data['transactions']:
                    tr_result_response = requests.get(f'{rpc_uri}{transaction["_expandable"]["result"]}')
                    if tr_result_response.status_code == 200:
                        tr_transaction_data_data = json.loads(tr_result_response.content)
                        transaction["result"] = tr_transaction_data_data
                        transaction_data["transactions"].append(transaction)
                    else:
                        logger.error("Cannot fetch transaction result")
                        return

                for transaction in transaction_data['transactions']:
                    return_data["transactions"].append({
                        "block_height": block_data['header']['height'],
                        "block_id": block_data["header"]["id"],
                        "transaction_id": transaction["id"],
                        "script": base64.b64decode(transaction["script"]).decode('utf-8'),
                        "arguments": json.dumps(list(map((lambda x: json.loads(base64.b64decode(x).decode('utf-8'))), transaction["arguments"]))),
                        "reference_block_id": transaction["reference_block_id"],
                        "gas_limit": transaction["gas_limit"],
                        "payer": transaction["payer"],
                        "proposal_key": json.dumps(transaction["proposal_key"]),
                        "authorizers": json.dumps(transaction["authorizers"]),
                        "payload_signatures": json.dumps(transaction["payload_signatures"]),
                        "envelope_signatures": json.dumps(transaction["envelope_signatures"]),
                        "execution": transaction["result"]["execution"],
                        "status": transaction["result"]["status"],
                        "status_code": transaction["result"]["status_code"],
                        "error_message": transaction["result"]["error_message"],
                        "computation_used": transaction["result"]["computation_used"],
                    })

                for transaction in transaction_data['transactions']:
                    for event in transaction['result']['events']:
                        return_data["events"].append({
                            "block_height": block_data['header']['height'],
                            "block_id": block_data["header"]["id"],
                            "transaction_id": transaction["id"],
                            "transaction_index": event["transaction_index"],
                            "event_index": event["event_index"],
                            "type": event["type"],
                            "payload": base64.b64decode(event["payload"]).decode('utf-8'),
                        })

        return return_data

    except requests.exceptions.ConnectionError:
        logger.error("Connection error occurred. Please check your internet connection or the server's availability.")
        return


# RabbitMQ communication

def processQueueMessage(ch, method, properties, body: str):
    """
    Get block ID from the RabbitMQ queue, process it and
    send structured block data to the blocks_writer queue
    """

    logger.info(f"Received message: {body}")
    json_data = json.loads(body)
    data = fetch_block_data(int(json_data['entity_id']))
    if (data):
        sendMessageToQueue(data)

    ch.basic_ack(delivery_tag=method.delivery_tag)


def sendMessageToQueue(message: dict[str, Any]):
    try:
        if channel is not None:
            channel.basic_publish(exchange='', routing_key=send_queue_name, body=json.dumps(message))
    except Exception:
        logger.info('Unable to send data to RabbitMQ')


# Main loop for work with RabbitMQ queue (with reconnection mechanism)
channel = None
while True:
    try:
        logger.info("Connecting to RabbitMQ")
        parameters = pika.URLParameters(str(os.environ.get('RABBITMQ')))
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        receive_queue_name = str(os.environ.get('RABBITMQ_QUEUE_BLOCK_PROCESSOR'))
        send_queue_name = str(os.environ.get('RABBITMQ_QUEUE_BLOCK_WRITER'))
        channel.queue_declare(queue=receive_queue_name, durable=True)
        channel.queue_declare(queue=send_queue_name, durable=True)

        # Read messages from queue
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=receive_queue_name, on_message_callback=processQueueMessage, auto_ack=False)

        logger.info('Waiting messages...')
        channel.start_consuming()

    except Exception as e:
        logger.error(f'Problem with RabbitMQ {e}')
        time.sleep(5)
        continue
