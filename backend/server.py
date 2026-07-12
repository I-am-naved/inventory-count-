from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import time

app = FastAPI()

origins = os.getenv('CORS_ORIGINS', '*').split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

class CountRow(BaseModel):
    productId: str
    productName: str
    qtyPerBox: int
    shelf: int = Field(ge=0)
    backstockBoxes: int = Field(ge=0)
    backstockLoose: int = Field(ge=0)
    delivery: int = Field(ge=0)

class CountRequest(BaseModel):
    note: Optional[str] = ''
    rows: List[CountRow]

class CountSummary(BaseModel):
    grandTotal: int
    productsCounted: int
    backstockBoxes: int

class CountResponse(CountRequest):
    id: int
    created_at: float
    summary: CountSummary

counts_db: List[CountResponse] = []
next_id = 1

PRODUCT_CATALOG = {
    'panaji-naan': 8,
    'brioche': 8,
    'sour-dough': 8,
    'pesent': 8,
    'brownie': 6,
    'cinnamon-roll': 6,
    'sugar-donut': 8,
    'cheese-stick': 6,
    'tortilla': 8,
    'banana-loaf': 16,
}

@app.get('/api/')
def api_health():
    return {'status': 'ok'}

@app.get('/health')
def health():
    return {
        'status': 'ok',
        'mongo_url': os.getenv('MONGO_URL', 'mongodb://localhost:27017'),
        'db_name': os.getenv('DB_NAME', 'test_database'),
    }

@app.get('/api/counts', response_model=List[CountResponse])
def list_counts():
    return sorted(counts_db, key=lambda item: item.created_at, reverse=True)

@app.post('/api/counts', response_model=CountResponse)
def create_count(payload: CountRequest = Body(...)):
    global next_id

    rows = []
    grand_total = 0
    backstock_boxes = 0
    products_counted = 0

    for row in payload.rows:
        qty_per_box = PRODUCT_CATALOG.get(row.productId, row.qtyPerBox)
        total = row.shelf + row.backstockBoxes * qty_per_box + row.backstockLoose + row.delivery
        if total > 0:
            products_counted += 1
        grand_total += total
        backstock_boxes += row.backstockBoxes
        rows.append(row)

    count = CountResponse(
        id=next_id,
        created_at=time.time(),
        note=payload.note,
        rows=rows,
        summary=CountSummary(
            grandTotal=grand_total,
            productsCounted=products_counted,
            backstockBoxes=backstock_boxes,
        ),
    )
    next_id += 1
    counts_db.append(count)
    return count

@app.get('/api/counts/{count_id}', response_model=CountResponse)
def get_count(count_id: int):
    for item in counts_db:
        if item.id == count_id:
            return item
    raise HTTPException(status_code=404, detail='Count not found')

@app.delete('/api/counts/{count_id}')
def delete_count(count_id: int):
    global counts_db
    counts_db = [item for item in counts_db if item.id != count_id]
    return {'status': 'deleted'}
